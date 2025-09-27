import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
// La importación corregida está aquí:
import { Box, Container, VStack, HStack, Text, Stat, SimpleGrid, Select, Button, Heading } from '@chakra-ui/react';
import { Line, Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend, BarController, LineController } from 'chart.js';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { subDays, format } from 'date-fns';
import * as XLSX from 'xlsx';

// --- CONFIGURACIÓN ---
ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend, BarController, LineController);
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// --- COMPONENTES ---

// El componente KpiCard corregido está aquí:
const KpiCard = ({ title, value, unit = '' }) => (
  <Stat p="4" borderWidth="1px" borderRadius="lg" bg="white">
    <Text fontSize="sm" color="gray.500">{title}</Text>
    <Text fontSize="2xl" fontWeight="bold">{value}{unit}</Text>
  </Stat>
);

// --- LÓGICA DE DATOS ---
const groupDataByTime = (surveys, groupBy) => {
  return surveys.reduce((acc, survey) => {
    let key;
    if (groupBy === 'day') key = format(new Date(survey.created_at), 'yyyy-MM-dd');
    if (groupBy === 'month') key = format(new Date(survey.created_at), 'yyyy-MM');
    if (groupBy === 'year') key = format(new Date(survey.created_at), 'yyyy');
    
    if (!acc[key]) acc[key] = [];
    acc[key].push(survey);
    return acc;
  }, {});
};

// --- COMPONENTE PRINCIPAL ---
function App() {
  const [allSurveys, setAllSurveys] = useState([]);
  const [locations, setLocations] = useState([]);
  
  const [locationFilter, setLocationFilter] = useState('Todos');
  const [dateRange, setDateRange] = useState([subDays(new Date(), 30), new Date()]);
  const [groupBy, setGroupBy] = useState('day');
  const [startDate, endDate] = dateRange;

  useEffect(() => {
    const fetchInitialData = async () => {
      const { data: surveysData } = await supabase.from('surveys').select('*');
      setAllSurveys(surveysData || []);
      const { data: locationsData } = await supabase.from('locations').select('*').where('is_active', 'eq', true).order('name');
      setLocations(locationsData || []);
    };
    fetchInitialData();
  }, []);

  const filteredSurveys = allSurveys.filter(survey => {
    const surveyDate = new Date(survey.created_at);
    const isLocationMatch = locationFilter === 'Todos' || survey.location_id === locationFilter;
    const isDateMatch = !startDate || !endDate || (surveyDate >= startDate && surveyDate <= endDate);
    return isLocationMatch && isDateMatch;
  });

  const total = filteredSurveys.length;
  const promoters = filteredSurveys.filter(s => s.score >= 9).length;
  const passives = filteredSurveys.filter(s => s.score >= 7 && s.score <= 8).length;
  const detractors = filteredSurveys.filter(s => s.score <= 6).length;
  const nps = total > 0 ? Math.round(((promoters - detractors) / total) * 100) : 0;

  const groupedData = groupDataByTime(filteredSurveys, groupBy);
  const chartLabels = Object.keys(groupedData).sort();
  
  const chartData = {
    labels: chartLabels,
    datasets: [
      { type: 'bar', label: 'Detractores', data: chartLabels.map(key => groupedData[key].filter(s => s.score <= 6).length), backgroundColor: '#e74c3c', stack: 'counts' },
      { type: 'bar', label: 'Pasivos', data: chartLabels.map(key => groupedData[key].filter(s => s.score >= 7 && s.score <= 8).length), backgroundColor: '#f1c40f', stack: 'counts' },
      { type: 'bar', label: 'Promotores', data: chartLabels.map(key => groupedData[key].filter(s => s.score >= 9).length), backgroundColor: '#2ecc71', stack: 'counts' },
      { type: 'line', label: 'NPS', data: chartLabels.map(key => calculateNps(groupedData[key])), borderColor: '#3498db', backgroundColor: 'rgba(52, 152, 219, 0.2)', yAxisID: 'y1' }
    ],
  };

  const chartOptions = {
    scales: {
      x: { stacked: true },
      y: { stacked: true, beginAtZero: true, position: 'left', title: { display: true, text: 'Nº de Respuestas' } },
      y1: { type: 'linear', position: 'right', beginAtZero: false, title: { display: true, text: 'Puntaje NPS' }, grid: { drawOnChartArea: false } }
    },
    responsive: true,
  };
  
  const handleExcelExport = () => {
    const dataToExport = filteredSurveys.map(s => ({
      Fecha: format(new Date(s.created_at), 'dd/MM/yyyy HH:mm'),
      Ubicación: s.location_id,
      Puntaje_NPS: s.score,
      Comentario: s.comment,
      Cal_Instalaciones: s.additional_ratings?.instalaciones,
      Cal_Limpieza: s.additional_ratings?.limpieza,
      Cal_Atencion: s.additional_ratings?.atencion,
      Cal_Ambiente: s.additional_ratings?.ambiente,
      Cal_CalidadPrecio: s.additional_ratings?.calidadPrecio,
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "NPS_RanchoSF");
    XLSX.writeFile(workbook, `Reporte_NPS_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  return (
    <Box bg="gray.50" minH="100vh">
      <Container maxW="container.xl" py="8">
        <VStack spacing="6" align="stretch">
          <Heading as="h1" size="lg">Dashboard de Experiencia del Cliente</Heading>
          
          <HStack bg="white" p="4" borderRadius="lg" borderWidth="1px" spacing="6">
            <Box>
              <Text fontWeight="bold" mb="2">Ubicación</Text>
              <Select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}>
                <option value="Todos">Todos los Espacios</option>
                {locations.map(loc => <option key={loc.id} value={loc.name}>{loc.name}</option>)}
              </Select>
            </Box>
            <Box>
               <Text fontWeight="bold" mb="2">Rango de Fecha</Text>
               <DatePicker
                 selectsRange={true}
                 startDate={startDate}
                 endDate={endDate}
                 onChange={(update) => setDateRange(update)}
                 isClearable={true}
                 dateFormat="dd/MM/yyyy"
                 customInput={<Button as="button">{startDate && endDate ? `${format(startDate, 'dd/MM/yy')} - ${format(endDate, 'dd/MM/yy')}` : 'Seleccionar Rango'}</Button>}
               />
            </Box>
            <Box flexGrow="1" />
            <Button colorScheme="teal" onClick={handleExcelExport} isDisabled={filteredSurveys.length === 0}>
              Exportar a Excel
            </Button>
          </HStack>

          <SimpleGrid columns={{ base: 2, md: 5 }} spacing="6">
            <KpiCard title="Puntaje NPS" value={nps} />
            <KpiCard title="% Promotores" value={total > 0 ? ((promoters / total) * 100).toFixed(1) : 0} unit="%" />
            <KpiCard title="% Pasivos" value={total > 0 ? ((passives / total) * 100).toFixed(1) : 0} unit="%" />
            <KpiCard title="% Detractores" value={total > 0 ? ((detractors / total) * 100).toFixed(1) : 0} unit="%" />
            <KpiCard title="Total Encuestas" value={total} />
          </SimpleGrid>

          <Box bg="white" p="4" borderRadius="lg" borderWidth="1px">
            <HStack mb="4">
              <Heading as="h3" size="md" flexGrow="1">Análisis de NPS en el Tiempo</Heading>
              <Select w="auto" value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
                <option value="day">Por Día</option>
                <option value="month">Por Mes</option>
                <option value="year">Por Año</option>
              </Select>
            </HStack>
            <Bar data={chartData} options={chartOptions} />
          </Box>
        </VStack>
      </Container>
    </Box>
  );
}

// Pequeño helper para el cálculo del NPS
function calculateNps(data) {
  if (!data || data.length === 0) return 0;
  const promoters = data.filter(s => s.score >= 9).length;
  const detractors = data.filter(s => s.score <= 6).length;
  return Math.round(((promoters - detractors) / data.length) * 100);
}

export default App;