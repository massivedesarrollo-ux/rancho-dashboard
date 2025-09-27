import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Bar, Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend } from 'chart.js';
import WordCloud from 'react-d3-cloud';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { subDays } from 'date-fns';
import './App.css';


// --- CONFIGURACIÓN ---
ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend);
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// --- COMPONENTES DE REPORTES (MOVIDOS AQUÍ PARA MAYOR CLARIDAD) ---

// GRÁFICO 1: EVOLUCIÓN DEL NPS
const NpsEvolutionChart = ({ surveys }) => {
  const dataByDay = surveys.reduce((acc, survey) => {
    const day = new Date(survey.created_at).toISOString().split('T')[0];
    if (!acc[day]) acc[day] = [];
    acc[day].push(survey);
    return acc;
  }, {});

  const chartLabels = Object.keys(dataByDay).sort();
  const npsScores = chartLabels.map(day => calculateNps(dataByDay[day]));

  const chartData = {
    labels: chartLabels,
    datasets: [{
      label: 'Evolución del NPS',
      data: npsScores,
      borderColor: '#3498db',
      backgroundColor: 'rgba(52, 152, 219, 0.1)',
      fill: true,
      tension: 0.3,
    }],
  };
  return <Line data={chartData} options={{ responsive: true }} />;
};

// GRÁFICO 2: RANKING DE ESPACIOS
const NpsRankingChart = ({ surveys, locations }) => {
  const npsByLocation = locations.map(loc => {
    const locationSurveys = surveys.filter(s => s.location_id === loc.name);
    return { name: loc.name, nps: calculateNps(locationSurveys) };
  }).sort((a, b) => b.nps - a.nps);

  const chartData = {
    labels: npsByLocation.map(l => l.name),
    datasets: [{
      label: 'NPS por Espacio',
      data: npsByLocation.map(l => l.nps),
      backgroundColor: npsByLocation.map(l => l.nps > 50 ? '#2ecc71' : l.nps > 0 ? '#f1c40f' : '#e74c3c'),
    }],
  };
  return <Bar data={chartData} options={{ indexAxis: 'y', responsive: true }} />;
};

// MÓDULO 3: PROMEDIO DE CALIFICACIONES ADICIONALES
const AverageRatings = ({ surveys }) => {
  const aspects = ['instalaciones', 'limpieza', 'atencion', 'ambiente', 'calidadPrecio'];
  if (surveys.length === 0) return <p>No hay datos suficientes.</p>;

  const averageScores = aspects.map(aspect => {
    const ratingsForAspect = surveys
      .map(s => s.additional_ratings?.[aspect])
      .filter(rating => typeof rating === 'number');
    const average = ratingsForAspect.reduce((sum, rating) => sum + rating, 0) / ratingsForAspect.length;
    return { aspect, average: average.toFixed(1) };
  });

  return (
    <div className="average-ratings">
      {averageScores.map(({ aspect, average }) => (
        <div key={aspect} className="rating-item">
          <span className="aspect-name">{aspect.charAt(0).toUpperCase() + aspect.slice(1)}</span>
          <span className="aspect-score">{isNaN(average) ? 'N/A' : average} ★</span>
        </div>
      ))}
    </div>
  );
};

// --- MÓDULO 4: MAPA DE PALABRAS (VERSIÓN ACTUALIZADA) ---

const CommentsWordcloud = ({ surveys }) => {
  // La lógica para procesar las palabras es la misma...
  const spanishStopWords = ['de', 'la', 'que', 'el', 'en', 'y', 'a', 'los', 'del', 'se', 'las', 'por', 'un', 'para', 'con', 'no', 'una', 'su', 'al', 'lo', 'como', 'más', 'pero', 'sus', 'le', 'ya', 'o', 'este', 'ha', 'muy', 'sin', 'sobre', 'también', 'me', 'hasta', 'hay', 'donde', 'quien', 'desde', 'todo', 'nos', 'durante', 'todos', 'uno', 'les', 'ni', 'contra', 'otros', 'ese', 'eso', 'ante', 'ellos', 'esto', 'mi', 'antes', 'algunos', 'qué', 'nada', 'poco', 'quienes', 'ese', 'mucho', 'alguien', 'algunas', 'otro', 'otras'];
  const text = surveys.map(s => s.comment).filter(Boolean).join(' ');
  const words = text.toLowerCase().split(/\s+/).filter(word => word.length > 2 && !spanishStopWords.includes(word));
  
  const wordFrequencies = words.reduce((acc, word) => {
    acc[word] = (acc[word] || 0) + 1;
    return acc;
  }, {});

  const wordcloudData = Object.entries(wordFrequencies).map(([text, value]) => ({ text, value }));
  
  if (wordcloudData.length === 0) return <p>No hay comentarios para mostrar.</p>;
  
  // Opciones de fuente para el wordcloud
  const fontSize = (word) => Math.log2(word.value) * 5 + 16;
  const rotate = () => (Math.random() > 0.5 ? 0 : 90);

  // El componente se llama diferente y recibe los datos en la prop 'data'
  return <WordCloud data={wordcloudData} fontSize={fontSize} rotate={rotate} />;
};


// --- FUNCIÓN HELPER PARA CALCULAR NPS ---
function calculateNps(data) {
  if (data.length === 0) return 0;
  const promoters = data.filter(s => s.score >= 9).length;
  const detractors = data.filter(s => s.score <= 6).length;
  return Math.round(((promoters - detractors) / data.length) * 100);
}


// --- COMPONENTE PRINCIPAL (APP) ---
function App() {
  // Estados de datos
  const [allSurveys, setAllSurveys] = useState([]);
  const [locations, setLocations] = useState([]);
  
  // Estados de filtros
  const [locationFilter, setLocationFilter] = useState('Todos');
  const [dateRange, setDateRange] = useState([subDays(new Date(), 30), new Date()]);
  const [startDate, endDate] = dateRange;

  // Carga inicial de datos
  useEffect(() => {
    const fetchInitialData = async () => {
      const { data: surveysData } = await supabase.from('surveys').select('*');
      setAllSurveys(surveysData || []);
      const { data: locationsData } = await supabase.from('locations').select('*').order('name');
      setLocations(locationsData || []);
    };
    fetchInitialData();
  }, []);

  // Filtrado de datos
  const filteredSurveys = allSurveys.filter(survey => {
    const surveyDate = new Date(survey.created_at);
    const isLocationMatch = locationFilter === 'Todos' || survey.location_id === locationFilter;
    const isDateMatch = surveyDate >= startDate && surveyDate <= (endDate || new Date());
    return isLocationMatch && isDateMatch;
  });

  return (
    <>
      <header className="main-header">
        <h1>Dashboard de Experiencia del Cliente</h1>
      </header>
      
      <main className="dashboard-container">
        <aside className="filters-sidebar">
          <h3>Filtros</h3>
          <div className="filter-group">
            <label>Ubicación</label>
            <select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}>
              <option value="Todos">Todos los Espacios</option>
              {locations.map(loc => <option key={loc.id} value={loc.name}>{loc.name}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <label>Rango de Fecha</label>
            <DatePicker
              selectsRange={true}
              startDate={startDate}
              endDate={endDate}
              onChange={(update) => setDateRange(update)}
              isClearable={true}
              dateFormat="dd/MM/yyyy"
            />
          </div>
        </aside>

        <section className="reports-grid">
          <div className="grid-card">
            <h3>Evolución del NPS</h3>
            <NpsEvolutionChart surveys={filteredSurveys} />
          </div>
          <div className="grid-card">
            <h3>Ranking NPS por Espacio</h3>
            <NpsRankingChart surveys={filteredSurveys} locations={locations.filter(l => l.is_active)} />
          </div>
          <div className="grid-card">
            <h3>Promedio de Calificaciones</h3>
            <AverageRatings surveys={filteredSurveys} />
          </div>
          <div className="grid-card">
            <h3>Mapa de Palabras (Comentarios)</h3>
            <div className="wordcloud-container">
              <CommentsWordcloud surveys={filteredSurveys} />
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

export default App;