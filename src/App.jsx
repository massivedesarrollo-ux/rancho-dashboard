import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
// Añadimos 'Radar' a la importación
import { Bar, Line, Radar } from 'react-chartjs-2';
// Añadimos los componentes necesarios para el gráfico de Radar
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend, RadialLinearScale, Filler } from 'chart.js';
import { format, getWeek, getYear } from 'date-fns';
import './App.css';

// Registramos los nuevos elementos para el gráfico de Radar
ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend, RadialLinearScale, Filler);

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// --- Función Helper para calcular NPS ---
function calculateNps(data) {
  if (!data || data.length === 0) return 0;
  const promoters = data.filter(s => s.score >= 9).length;
  const detractors = data.filter(s => s.score <= 6).length;
  return Math.round(((promoters - detractors) / data.length) * 100);
}

function App() {
  const [allSurveys, setAllSurveys] = useState([]);
  const [locations, setLocations] = useState([]);
  const [locationFilter, setLocationFilter] = useState('Todos');
  const [groupBy, setGroupBy] = useState('day');

  useEffect(() => {
    // ... (El useEffect para cargar datos iniciales no cambia)
    const fetchInitialData = async () => {
      const { data: surveysData } = await supabase.from('surveys').select('*');
      setAllSurveys(surveysData || []);
      const { data: locationsData } = await supabase.from('locations').select('*').eq('is_active', true).order('name');
      setLocations(locationsData || []);
    };
    fetchInitialData();

    const channel = supabase.channel('realtime surveys').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'surveys' }, 
        (payload) => setAllSurveys(currentSurveys => [...currentSurveys, payload.new])
      ).subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  const filteredSurveys = locationFilter === 'Todos' 
    ? allSurveys 
    : allSurveys.filter(s => s.location_id === locationFilter);

  // --- Cálculos para KPIs (no cambia) ---
  const total = filteredSurveys.length;
  const promoters = filteredSurveys.filter(s => s.score >= 9).length;
  const passives = filteredSurveys.filter(s => s.score >= 7 && s.score <= 8).length;
  const detractors = filteredSurveys.filter(s => s.score <= 6).length;
  const nps = calculateNps(filteredSurveys);
  const promotersPercent = total > 0 ? ((promoters / total) * 100).toFixed(1) : 0;
  const passivesPercent = total > 0 ? ((passives / total) * 100).toFixed(1) : 0;
  const detractorsPercent = total > 0 ? ((detractors / total) * 100).toFixed(1) : 0;

  // --- LÓGICA PARA GRÁFICOS DE TENDENCIAS (no cambia) ---
  const groupedData = filteredSurveys.reduce((acc, survey) => {
    const date = new Date(survey.created_at);
    let key = '';
    if (groupBy === 'day') key = format(date, 'yyyy-MM-dd');
    if (groupBy === 'week') key = `${getYear(date)}-W${getWeek(date)}`;
    if (groupBy === 'month') key = format(date, 'yyyy-MM');
    if (!acc[key]) acc[key] = [];
    acc[key].push(survey);
    return acc;
  }, {});

  const evolutionLabels = Object.keys(groupedData).sort();
  const evolutionData = {
    labels: evolutionLabels,
    datasets: [{
      label: 'NPS',
      data: evolutionLabels.map(key => calculateNps(groupedData[key])),
      borderColor: '#3498db',
      backgroundColor: 'rgba(52, 152, 219, 0.1)',
      fill: true,
      tension: 0.3
    }]
  };

  const rankingData = {
    labels: locations.map(loc => loc.name),
    datasets: [{
      label: 'NPS',
      data: locations.map(loc => calculateNps(allSurveys.filter(s => s.location_id === loc.name))),
      backgroundColor: '#34495e'
    }]
  };

  // --- NUEVA LÓGICA PARA GRÁFICO DE RADAR ---
  const aspects = ['instalaciones', 'limpieza', 'atencion', 'ambiente', 'calidadPrecio'];
  const aspectLabels = ['Instalaciones', 'Limpieza', 'Atención', 'Ambiente', 'Calidad/Precio'];

  const averageScores = aspects.map(aspect => {
    const ratingsForAspect = filteredSurveys
      .map(s => s.additional_ratings?.[aspect])
      .filter(rating => typeof rating === 'number' && rating > 0);
    
    if (ratingsForAspect.length === 0) return 0;

    const average = ratingsForAspect.reduce((sum, rating) => sum + rating, 0) / ratingsForAspect.length;
    return average.toFixed(1);
  });
  
  const radarData = {
    labels: aspectLabels,
    datasets: [{
      label: 'Calificación Promedio (1-5)',
      data: averageScores,
      backgroundColor: 'rgba(255, 99, 132, 0.2)',
      borderColor: 'rgba(255, 99, 132, 1)',
      borderWidth: 2,
    }]
  };
  
  return (
    <div className="dashboard">
      <header><h1>Dashboard de Experiencia del Cliente</h1></header>
      
      <div className="filters">
        {/* ... (Filtros no cambian) ... */}
        <button onClick={() => setLocationFilter('Todos')} className={locationFilter === 'Todos' ? 'active' : ''}>Todos</button>
        {locations.map(location => (
          <button key={location.id} className={locationFilter === location.name ? 'active' : ''} onClick={() => setLocationFilter(location.name)}>
            {location.name}
          </button>
        ))}
      </div>

      <div className="kpi-info"><p>Mostrando <strong>{total}</strong> encuestas</p></div>
      <div className="kpi-grid">
        {/* ... (Tarjetas KPI no cambian) ... */}
        <div className="kpi-card"><h2>Puntaje NPS</h2><p className={`score ${nps > 50 ? 'good' : nps > 0 ? 'medium' : 'bad'}`}>{nps}</p></div>
        <div className="kpi-card"><h2>Promotores</h2><p className="score good">{promotersPercent}%</p></div>
        <div className="kpi-card"><h2>Pasivos</h2><p className="score medium">{passivesPercent}%</p></div>
        <div className="kpi-card"><h2>Detractores</h2><p className="score bad">{detractorsPercent}%</p></div>
      </div>
      
      <div className="charts-grid">
        <div className="chart-card">
          <div className="chart-header">
            <h3>Evolución de NPS</h3>
            <div className="time-group">
              <button onClick={() => setGroupBy('day')} className={groupBy === 'day' ? 'active' : ''}>Día</button>
              <button onClick={() => setGroupBy('week')} className={groupBy === 'week' ? 'active' : ''}>Semana</button>
              <button onClick={() => setGroupBy('month')} className={groupBy === 'month' ? 'active' : ''}>Mes</button>
            </div>
          </div>
          <Line data={evolutionData} />
        </div>
        <div className="chart-card">
          <div className="chart-header">
            <h3>Ranking NPS por Espacio</h3>
          </div>
          <Bar data={rankingData} options={{ indexAxis: 'y', responsive: true }} />
        </div>
        
        {/* --- NUEVO GRÁFICO DE RADAR AÑADIDO A LA CUADRÍCULA --- */}
        <div className="chart-card">
          <div className="chart-header">
            <h3>Análisis de Atributos</h3>
          </div>
          <Radar data={radarData} options={{ scales: { r: { beginAtZero: true, max: 5 } } }}/>
        </div>

      </div>

      <div className="comments-container">
        {/* ... (La sección de comentarios no cambia) ... */}
      </div>
    </div>
  );
}

export default App;