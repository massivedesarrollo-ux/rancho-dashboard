import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import './App.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

function App() {
  const [allSurveys, setAllSurveys] = useState([]);
  const [locations, setLocations] = useState([]);
  const [locationFilter, setLocationFilter] = useState('Todos');

  useEffect(() => {
    const fetchInitialData = async () => {
      // Cargamos tanto las encuestas como las ubicaciones activas
      const { data: surveysData } = await supabase.from('surveys').select('*');
      setAllSurveys(surveysData || []);
      const { data: locationsData } = await supabase.from('locations').select('*').eq('is_active', true).order('name');
      setLocations(locationsData || []);
    };
    fetchInitialData();

    const channel = supabase
      .channel('realtime surveys')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'surveys' }, 
        (payload) => setAllSurveys(currentSurveys => [...currentSurveys, payload.new])
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  const filteredSurveys = locationFilter === 'Todos' 
    ? allSurveys 
    : allSurveys.filter(s => s.location_id === locationFilter);

  // --- NUEVA SECCIÓN DE CÁLCULOS PARA KPIs ---
  const total = filteredSurveys.length;
  const promoters = filteredSurveys.filter(s => s.score >= 9).length;
  const passives = filteredSurveys.filter(s => s.score >= 7 && s.score <= 8).length;
  const detractors = filteredSurveys.filter(s => s.score <= 6).length;
  
  const nps = total > 0 ? Math.round(((promoters - detractors) / total) * 100) : 0;
  const promotersPercent = total > 0 ? ((promoters / total) * 100).toFixed(1) : 0;
  const passivesPercent = total > 0 ? ((passives / total) * 100).toFixed(1) : 0;
  const detractorsPercent = total > 0 ? ((detractors / total) * 100).toFixed(1) : 0;
  // --- FIN DE LA NUEVA SECCIÓN ---

  // Lógica para el gráfico de barras (sin cambios)
  const scoreCounts = Array(11).fill(0);
  filteredSurveys.forEach(survey => scoreCounts[survey.score]++);

  const chartData = {
    labels: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
    datasets: [{
      label: '# de Votos',
      data: scoreCounts,
      backgroundColor: scoreCounts.map((_, i) => 
        i <= 6 ? 'rgba(255, 99, 132, 0.6)' :
        i <= 8 ? 'rgba(255, 206, 86, 0.6)' :
        'rgba(75, 192, 192, 0.6)'
      ),
    }],
  };
  
  return (
    <div className="dashboard">
      <header><h1>Dashboard de Experiencia del Cliente</h1></header>
      
      <div className="filters">
        <button onClick={() => setLocationFilter('Todos')} className={locationFilter === 'Todos' ? 'active' : ''}>Todos</button>
        {/* Ahora los filtros se leen de la tabla 'locations' */}
        {locations.map(location => (
          <button key={location.id} className={locationFilter === location.name ? 'active' : ''} onClick={() => setLocationFilter(location.name)}>
            {location.name}
          </button>
        ))}
      </div>

      {/* --- NUEVA SECCIÓN DE TARJETAS KPI --- */}
      <div className="kpi-info">
        <p>Mostrando <strong>{total}</strong> encuestas</p>
      </div>
      <div className="kpi-grid">
        <div className="kpi-card">
          <h2>Puntaje NPS</h2>
          <p className={`score ${nps > 50 ? 'good' : nps > 0 ? 'medium' : 'bad'}`}>{nps}</p>
        </div>
        <div className="kpi-card">
          <h2>Promotores</h2>
          <p className="score good">{promotersPercent}%</p>
        </div>
        <div className="kpi-card">
          <h2>Pasivos</h2>
          <p className="score medium">{passivesPercent}%</p>
        </div>
        <div className="kpi-card">
          <h2>Detractores</h2>
          <p className="score bad">{detractorsPercent}%</p>
        </div>
      </div>
      {/* --- FIN DE LA NUEVA SECCIÓN --- */}


      <div className="chart-container">
        <h2>Distribución de Calificaciones</h2>
        <Bar data={chartData} />
      </div>

      <div className="comments-container">
        <h2>Últimos Comentarios</h2>
        <ul>
          {filteredSurveys.filter(s => s.comment).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map(s => (
              <li key={s.id}>
                <span className="comment-score">{s.score}</span>
                <div>
                  <p>{s.comment}</p>
                  <small>{s.location_id} - {new Date(s.created_at).toLocaleString()}</small>
                </div>
              </li>
            ))}
        </ul>
      </div>
    </div>
  );
}

export default App;