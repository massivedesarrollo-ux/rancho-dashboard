import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import './App.css';

// Registra los componentes de Chart.js que vamos a usar
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// 1. CONFIGURACIÓN DE SUPABASE (Usa las mismas credenciales que antes)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

function App() {
  const [surveys, setSurveys] = useState([]);
  const [nps, setNps] = useState(0);

  // 2. FUNCIÓN PARA OBTENER DATOS Y CALCULAR NPS
  const fetchData = async () => {
    const { data, error } = await supabase.from('surveys').select('*');
    if (error) {
      console.error('Error fetching data:', error);
      return;
    }

    setSurveys(data);
    calculateNps(data);
  };

  const calculateNps = (data) => {
    const promoters = data.filter(s => s.score >= 9).length;
    const detractors = data.filter(s => s.score <= 6).length;
    const total = data.length;

    if (total === 0) {
      setNps(0);
      return;
    }

    const npsScore = ((promoters / total) - (detractors / total)) * 100;
    setNps(Math.round(npsScore));
  };
  
  // 3. USEEFFECT PARA CARGAR DATOS INICIALES Y SUSCRIBIRSE A CAMBIOS EN TIEMPO REAL
  useEffect(() => {
    // Carga los datos la primera vez que el componente se monta
    fetchData();

    // ¡Aquí está la magia del tiempo real!
    // Supabase nos avisa cada vez que se INSERTA una nueva fila en la tabla 'surveys'
    const channel = supabase
      .channel('realtime surveys')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'surveys' }, (payload) => {
        console.log('¡Nuevo registro!', payload.new);
        // Agregamos el nuevo registro a nuestro estado actual para actualizar la UI
        setSurveys(currentSurveys => {
          const updatedSurveys = [...currentSurveys, payload.new];
          calculateNps(updatedSurveys); // Recalculamos el NPS con el nuevo dato
          return updatedSurveys;
        });
      })
      .subscribe();

    // Limpiamos la suscripción cuando el componente se desmonta
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // 4. PREPARAMOS LOS DATOS PARA EL GRÁFICO DE BARRAS
  const scoreCounts = Array(11).fill(0);
  surveys.forEach(survey => {
    scoreCounts[survey.score]++;
  });

  const chartData = {
    labels: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
    datasets: [{
      label: '# de Votos',
      data: scoreCounts,
      backgroundColor: scoreCounts.map((_, i) => 
        i <= 6 ? 'rgba(255, 99, 132, 0.6)' : // Detractores (Rojo)
        i <= 8 ? 'rgba(255, 206, 86, 0.6)' : // Pasivos (Amarillo)
        'rgba(75, 192, 192, 0.6)'          // Promotores (Verde)
      ),
    }],
  };
  
  // 5. RENDERIZAMOS LOS COMPONENTES EN PANTALLA
  return (
    <div className="dashboard">
      <header>
        <h1>Dashboard de Experiencia del Cliente</h1>
      </header>

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
          {surveys
            .filter(s => s.comment) // Mostramos solo los que tienen comentario
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) // Ordenamos por más reciente
            .map(s => (
              <li key={s.id}>
                <span className="comment-score">{s.score}</span>
                <p>{s.comment}</p>
                <small>{s.location_id} - {new Date(s.created_at).toLocaleString()}</small>
              </li>
            ))
          }
        </ul>
      </div>
    </div>
  );
}

export default App;