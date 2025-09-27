import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Box, Container, VStack, HStack, Text, Stat, SimpleGrid, Select, Button, Heading } from '@chakra-ui/react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { subDays, format } from 'date-fns';
import * as XLSX from 'xlsx';

// --- CONFIGURACIÓN ---
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// --- LÓGICA DE DATOS Y COMPONENTES ---

const KpiCard = ({ title, value, unit = '' }) => (
  <Stat p="4" borderWidth="1px" borderRadius="lg" bg="white" boxShadow="sm">
    <Text fontSize="sm" color="gray.500">{title}</Text>
    <Text fontSize="2xl" fontWeight="bold">{value}{unit}</Text>
  </Stat>
);

function calculateNps(data) {
  if (!data || data.length === 0) return 0;
  const promoters = data.filter(s => s.score >= 9).length;
  const detractors = data.filter(s => s.score <= 6).length;
  return Math.round(((promoters - detractors) / data.length) * 100);
}

// --- COMPONENTE PRINCIPAL ---
function App() {
  const [allSurveys, setAllSurveys] = useState([]);
  const [locations, setLocations] = useState([]);
  
  const [locationFilter, setLocationFilter] = useState('Todos');
  const [dateRange, setDateRange] = useState([subDays(new Date(), 30), new Date()]);
  const [startDate, endDate] = dateRange || [null, null];

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
  const nps = calculateNps(filteredSurveys);

  // Preparación de datos para Recharts
  const dataByDay = filteredSurveys.reduce((acc, survey) => {
    const day = format(new Date(survey.created_at), 'yyyy-MM-dd');
    if (!acc[day]) acc[day] = [];
    acc[day].push(survey);
    return acc;
  }, {});
  
  const evolutionData = Object.keys(dataByDay).sort().map(day => ({
    name: day,
    NPS: calculateNps(dataByDay[day]),
  }));

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
          
          <HStack bg="white" p="4" borderRadius="lg" borderWidth="1px" spacing="6" boxShadow="sm">
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

          <Box bg="white" p="4" borderRadius="lg" borderWidth="1px" h="400px" boxShadow="sm">
            <Heading as="h3" size="md" mb="4">Evolución del NPS en el Tiempo</Heading>
            <ResponsiveContainer width="100%" height="90%">
              <LineChart data={evolutionData} margin={{ top: 5, right: 30, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="NPS" stroke="#3498db" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        </VStack>
      </Container>
    </Box>
  );
}

export default App;