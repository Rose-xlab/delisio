import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Paper, 
  Typography, 
  Grid, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  Button,
  CircularProgress,
  Card,
  CardContent,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Link,
  IconButton,
  Tooltip,
  Alert
} from '@mui/material';
import { 
  Refresh, 
  Error as ErrorIcon, 
  Warning as WarningIcon,
  Info as InfoIcon,
  PieChart,
  OpenInNew
} from '@mui/icons-material';
import { Line, Pie } from 'react-chartjs-2';
import { Chart, registerables } from 'chart.js';
import { getErrorTrends, getFrequentErrors, getUserImpact } from '../services/errors';

// Register ChartJS components
Chart.register(...registerables);

function Errors() {
  const [errorTrends, setErrorTrends] = useState(null);
  const [frequentErrors, setFrequentErrors] = useState(null);
  const [userImpact, setUserImpact] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState('7d');
  const [errorLimit, setErrorLimit] = useState(10);

  const fetchErrorData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch data from API endpoints
      const [trends, frequent, impact] = await Promise.all([
        getErrorTrends(period),
        getFrequentErrors(errorLimit),
        getUserImpact()
      ]);
      
      setErrorTrends(trends);
      setFrequentErrors(frequent);
      setUserImpact(impact);
    } catch (err) {
      console.error('Failed to fetch error data:', err);
      setError('Failed to load error data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchErrorData();
    
    // Polling interval for updates
    const intervalId = setInterval(fetchErrorData, 60000);
    return () => clearInterval(intervalId);
  }, [period, errorLimit]);

  // Prepare error trends chart data
  const prepareErrorTrendsData = () => {
    if (!errorTrends) return null;
    
    return {
      labels: errorTrends.map(item => item.date),
      datasets: [
        {
          label: 'Errors',
          data: errorTrends.map(item => item.count),
          borderColor: '#f44336', // Red
          backgroundColor: 'rgba(244, 67, 54, 0.1)', // Light red
          fill: true,
        }
      ]
    };
  };

  // Prepare user impact chart data
  const prepareUserImpactData = () => {
    if (!userImpact || !userImpact.impactByComponent) return null;
    
    return {
      labels: userImpact.impactByComponent.map(item => item.component),
      datasets: [
        {
          data: userImpact.impactByComponent.map(item => item.usersImpacted),
          backgroundColor: [
            '#f44336', // Red
            '#ff9800', // Orange
            '#2196f3', // Blue
            '#4caf50', // Green
            '#9c27b0', // Purple
            '#795548'  // Brown
          ],
          borderWidth: 1
        }
      ]
    };
  };

  const getErrorLevelIcon = (level) => {
    switch (level.toLowerCase()) {
      case 'error':
        return <ErrorIcon color="error" />;
      case 'warning':
        return <WarningIcon color="warning" />;
      case 'info':
        return <InfoIcon color="info" />;
      default:
        return <ErrorIcon color="error" />;
    }
  };

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch (e) {
      return dateString;
    }
  };

  const commonChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      }
    }
  };

  if (loading && !errorTrends) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="error">{error}</Typography>
        <Button 
          variant="outlined" 
          startIcon={<Refresh />} 
          onClick={fetchErrorData}
          sx={{ mt: 2 }}
        >
          Retry
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="h4" gutterBottom>
        Error Monitoring
      </Typography>
      
      {/* Error Trends */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Error Trends</Typography>
          
          <FormControl sx={{ width: 120 }} size="small">
            <InputLabel>Period</InputLabel>
            <Select
              value={period}
              label="Period"
              onChange={(e) => setPeriod(e.target.value)}
            >
              <MenuItem value="24h">24 hours</MenuItem>
              <MenuItem value="7d">7 days</MenuItem>
              <MenuItem value="30d">30 days</MenuItem>
              <MenuItem value="90d">90 days</MenuItem>
            </Select>
          </FormControl>
        </Box>
        
        <Box sx={{ height: 300 }}>
          {errorTrends && errorTrends.length > 0 ? (
            <Line 
            data={prepareErrorTrendsData()} 
              options={{
                ...commonChartOptions,
                scales: {
                  y: {
                    beginAtZero: true,
                    title: {
                      display: true,
                      text: 'Error Count'
                    }
                  },
                  x: {
                    title: {
                      display: true,
                      text: 'Date'
                    }
                  }
                },
                plugins: {
                  ...commonChartOptions.plugins,
                  title: {
                    display: true,
                    text: 'Error Frequency Over Time'
                  }
                }
              }} 
            />
          ) : (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
              <Typography variant="body1" color="text.secondary">
                No error data available for the selected period
              </Typography>
            </Box>
          )}
        </Box>
        
        {errorTrends && errorTrends.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Alert severity="info">
              Total errors in period: {errorTrends.reduce((sum, day) => sum + day.count, 0)}
            </Alert>
          </Box>
        )}
      </Paper>
      
      {/* Most Frequent Errors */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Most Frequent Errors</Typography>
          
          <FormControl sx={{ width: 120 }} size="small">
            <InputLabel>Limit</InputLabel>
            <Select
              value={errorLimit}
              label="Limit"
              onChange={(e) => setErrorLimit(e.target.value)}
            >
              <MenuItem value={5}>Top 5</MenuItem>
              <MenuItem value={10}>Top 10</MenuItem>
              <MenuItem value={20}>Top 20</MenuItem>
            </Select>
          </FormControl>
        </Box>
        
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Level</TableCell>
                <TableCell>Error</TableCell>
                <TableCell align="right">Count</TableCell>
                <TableCell align="right">Users Affected</TableCell>
                <TableCell>Last Seen</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {frequentErrors && frequentErrors.length > 0 ? (
                frequentErrors.map((item) => (
                  <TableRow key={item.id} hover>
                    <TableCell>
                      {getErrorLevelIcon(item.level)}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" noWrap sx={{ maxWidth: 300 }}>
                        {item.title}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Chip 
                        label={item.count} 
                        color={item.count > 20 ? "error" : item.count > 10 ? "warning" : "default"} 
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">
                      {item.userCount}
                    </TableCell>
                    <TableCell>
                      {formatDate(item.lastSeen)}
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="View in Sentry">
                        <IconButton 
                          size="small" 
                          color="primary" 
                          component={Link} 
                          href={item.link} 
                          target="_blank"
                        >
                          <OpenInNew fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    No frequent errors found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
      
      {/* User Impact */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>User Impact</Typography>
        
        <Grid container spacing={3}>
          <Grid item xs={12} md={5}>
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="subtitle1" gutterBottom>
                  Users Affected by Errors
                </Typography>
                
                <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                  <ErrorIcon color="error" fontSize="large" sx={{ mr: 1 }} />
                  <Typography variant="h4">
                    {userImpact?.totalUsersImpactedApproximation || 0}
                  </Typography>
                </Box>
                
                <Box sx={{ mt: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Approximately {userImpact?.percentageOfAllUsersApproximation || 0}% of all users affected
                  </Typography>
                </Box>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent>
                <Typography variant="subtitle1" gutterBottom>
                  Most Affected Components
                </Typography>
                
                {userImpact?.impactByComponent && userImpact.impactByComponent.length > 0 ? (
                  <Box>
                    {userImpact.impactByComponent.map((component, idx) => (
                      <Box key={idx} sx={{ mt: 1 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                            {component.component}:
                          </Typography>
                          <Typography variant="body2" fontWeight="bold">
                            {component.usersImpacted} users ({component.percentage}%)
                          </Typography>
                        </Box>
                        <LinearProgressWithColor value={component.percentage} />
                      </Box>
                    ))}
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No component impact data available
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={7}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="subtitle1" gutterBottom>
                  User Impact by Component
                </Typography>
                
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
                  {userImpact?.impactByComponent && userImpact.impactByComponent.length > 0 ? (
                    <Pie 
                      data={prepareUserImpactData()} 
                      options={{
                        ...commonChartOptions,
                        plugins: {
                          ...commonChartOptions.plugins,
                          title: {
                            display: true,
                            text: 'Users Affected by Component'
                          }
                        }
                      }} 
                    />
                  ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <PieChart sx={{ fontSize: 60, color: 'text.disabled', mb: 2 }} />
                      <Typography variant="body2" color="text.secondary">
                        No user impact data available
                      </Typography>
                    </Box>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
}

// Helper component for colored progress bars
const LinearProgressWithColor = ({ value }) => {
  const getColor = (val) => {
    if (val >= 60) return '#f44336'; // red
    if (val >= 30) return '#ff9800'; // orange
    return '#4caf50'; // green
  };
  
  return (
    <Box sx={{ width: '100%', mt: 0.5 }}>
      <Box
        sx={{
          height: 6,
          borderRadius: 3,
          width: `${value}%`,
          maxWidth: '100%',
          bgcolor: getColor(value)
        }}
      />
    </Box>
  );
};

export default Errors;