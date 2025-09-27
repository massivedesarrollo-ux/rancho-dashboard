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
  const [nps, setNps] = useState(0);
  const [locationFilter, setLocationFilter] = useState('Todos');

  useEffect(() => {
    const fetchInitialData = async () => {
      const { data } = await supabase.from('surveys').select('*');
      setAllSurveys(data || []);
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

  useEffect(() => {
    const promoters = filteredSurveys.filter(s => s.score >= 9).length;
    const detractors = filteredSurveys.filter(s => s.score <= 6).length;
    const total = filteredSurveys.length;

    if (total === 0) setNps(0);
    else setNps(Math.round(((promoters - detractors) / total) * 100));
  }, [filteredSurveys]);

  const locations = ['Todos', ...Array.from(new Set(allSurveys.map(s => s.location_id)))];
  
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
        {locations.map(location => (
          <button key={location} className={locationFilter === location ? 'active' : ''} onClick={() => setLocationFilter(location)}>
            {location}
          </button>
        ))}
      </div>

      <div className="nps-display">
        <h2>Net Promoter Score (NPS)</h2>
        <p className={`score ${nps > 50 ? 'good' : nps > 0 ? 'medium' : 'bad'}`}>{nps}</p>
      </div>

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