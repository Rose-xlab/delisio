import React, { useState, useEffect } from 'react';
import { Grid, Paper, Typography, Box, CircularProgress, MenuItem, Select, FormControl, InputLabel } from '@mui/material';
import { People, RestaurantMenu, AttachMoney, Error, Speed } from '@mui/icons-material';
import { Line } from 'react-chartjs-2';
import { Chart, registerables } from 'chart.js';
import { getDashboardStats, getDashboardTrends } from '../services/dashboard';

// Register ChartJS components
Chart.register(...registerables);

// Stats card component
const StatsCard = ({ title, value, icon, color }) => (
  <Paper elevation={2} sx={{ p: 2, display: 'flex', flexDirection: 'column', height: 140 }}>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
      <Typography color="text.secondary" variant="body2">{title}</Typography>
      {icon && <Box sx={{ color: color || 'primary.main' }}>{icon}</Box>}
    </Box>
    <Typography component="p" variant="h4">
      {value}
    </Typography>
  </Paper>
);

// Chart card component
const ChartCard = ({ title, children, period, onPeriodChange }) => (
  <Paper elevation={2} sx={{ p: 2, display: 'flex', flexDirection: 'column', height: 340 }}>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
      <Typography color="text.secondary" variant="body2">{title}</Typography>
      {onPeriodChange && (
        <FormControl size="small" sx={{ width: 120 }}>
          <InputLabel id={`${title}-period-label`}>Period</InputLabel>
          <Select
            labelId={`${title}-period-label`}
            value={period}
            label="Period"
            onChange={(e) => onPeriodChange(e.target.value)}
          >
            <MenuItem value="7d">7 days</MenuItem>
            <MenuItem value="30d">30 days</MenuItem>
            <MenuItem value="90d">90 days</MenuItem>
            <MenuItem value="6m">6 months</MenuItem>
          </Select>
        </FormControl>
      )}
    </Box>
    {children}
  </Paper>
);

// Queue status component
const QueueStatusCard = ({ queueHealth }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'healthy': return '#4caf50';
      case 'warning': return '#ff9800';
      case 'critical': return '#f44336';
      default: return '#9e9e9e';
    }
  };

  return (
    <Paper elevation={2} sx={{ p: 2, height: 300 }}>
      <Typography variant="h6" gutterBottom>Queue Status</Typography>
      {queueHealth && Object.entries(queueHealth).map(([queueName, data]) => (
        <Box key={queueName} sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body1" sx={{ textTransform: 'capitalize' }}>
              {queueName} Queue
            </Typography>
            <Box sx={{ 
              backgroundColor: getStatusColor(data.health?.status), 
              width: 12, 
              height: 12, 
              borderRadius: '50%' 
            }} />
          </Box>
          <Box sx={{ display: 'flex', mt: 1 }}>
            <Typography variant="body2" sx={{ mr: 2 }}>
              Active: {data.counts?.active || 0}
            </Typography>
            <Typography variant="body2" sx={{ mr: 2 }}>
              Waiting: {data.counts?.waiting || 0}
            </Typography>
            <Typography variant="body2">
              Failed: {data.counts?.failed || 0}
            </Typography>
          </Box>
        </Box>
      ))}
    </Paper>
  );
};

function Dashboard() {
  const [stats, setStats] = useState(null);
  const [trends, setTrends] = useState(null);
  const [period, setPeriod] = useState('30d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch data from real API endpoints
        const [statsData, trendsData] = await Promise.all([
          getDashboardStats(),
          getDashboardTrends(period)
        ]);
        
        setStats(statsData);
        setTrends(trendsData);
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
        setError('Failed to load dashboard data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
    
    // Set up polling for real-time updates
    const intervalId = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(intervalId);
  }, [period]);

  // Prepare chart data
  const userGrowthChartData = {
    labels: trends?.userGrowth?.map(item => item.date) || [],
    datasets: [
      {
        label: 'New Users',
        data: trends?.userGrowth?.map(item => item.new_users) || [],
        borderColor: '#1976d2',
        backgroundColor: 'rgba(25, 118, 210, 0.1)',
        fill: true,
      },
      {
        label: 'Total Users',
        data: trends?.userGrowth?.map(item => item.cumulative_users) || [],
        borderColor: '#42a5f5',
        backgroundColor: 'rgba(66, 165, 245, 0.1)',
        fill: true,
      }
    ]
  };

  const recipeGenerationsChartData = {
    labels: trends?.recipeGenerations?.map(item => item.period) || [],
    datasets: [
      {
        label: 'Recipe Generations',
        data: trends?.recipeGenerations?.map(item => item.recipe_count) || [],
        borderColor: '#4caf50',
        backgroundColor: 'rgba(76, 175, 80, 0.1)',
        fill: true,
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
      }
    }
  };

  if (loading && !stats) {
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
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>
      
      <Grid container spacing={3}>
        {/* Stats Cards */}
        <Grid item xs={12} sm={6} md={3}>
          <StatsCard 
            title="Active Users (24h)" 
            value={stats?.activeUsers || 0} 
            icon={<People />}
            color="primary.main"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatsCard 
            title="Recipe Generations Today" 
            value={stats?.recipeGenerationsToday || 0} 
            icon={<RestaurantMenu />}
            color="success.main"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatsCard 
            title="Monthly Revenue" 
            value={`$${stats?.revenue?.currentMonth?.toFixed(2) || '0.00'}`} 
            icon={<AttachMoney />}
            color="info.main"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatsCard 
            title="Recent Errors (24h)" 
            value={stats?.errorCount || 0} 
            icon={<Error />}
            color="error.main"
          />
        </Grid>
        
        {/* Charts */}
        <Grid item xs={12} md={6}>
          <ChartCard 
            title="User Growth" 
            period={period}
            onPeriodChange={setPeriod}
          >
            <Box sx={{ height: 250 }}>
              {trends?.userGrowth ? (
                <Line data={userGrowthChartData} options={chartOptions} />
              ) : (
                <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CircularProgress size={24} />
                </Box>
              )}
            </Box>
          </ChartCard>
        </Grid>
        <Grid item xs={12} md={6}>
          <ChartCard 
            title="Recipe Generations" 
            period={period}
            onPeriodChange={setPeriod}
          >
            <Box sx={{ height: 250 }}>
              {trends?.recipeGenerations ? (
                <Line data={recipeGenerationsChartData} options={chartOptions} />
              ) : (
                <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CircularProgress size={24} />
                </Box>
              )}
            </Box>
          </ChartCard>
        </Grid>
        
        {/* Queue Status */}
        <Grid item xs={12} md={6}>
          <QueueStatusCard queueHealth={stats?.queueHealth} />
        </Grid>
        
        {/* Error Summary */}
        <Grid item xs={12} md={6}>
          <Paper elevation={2} sx={{ p: 2, height: 300 }}>
            <Typography variant="h6" gutterBottom>Error Summary</Typography>
            
            <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
              <Error color="error" sx={{ mr: 1 }} />
              <Typography variant="h4">{stats?.errorCount || 0}</Typography>
              <Typography variant="body1" sx={{ ml: 1 }}>errors in the last 24h</Typography>
            </Box>
            
            {trends?.errors && trends.errors.length > 0 && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle2" gutterBottom>Most affected components:</Typography>
                {stats?.errorsByComponent?.slice(0, 3).map((comp, i) => (
                  <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                    <Typography variant="body2">{comp.component}</Typography>
                    <Typography variant="body2">{comp.count} errors</Typography>
                  </Box>
                ))}
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

export default Dashboard;