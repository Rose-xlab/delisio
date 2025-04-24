// admin-frontend/src/pages/Subscriptions.jsx
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
 Divider,
 CircularProgress,
 Card,
 CardContent,
 Table,
 TableBody,
 TableCell,
 TableContainer,
 TableHead,
 TableRow,
 Chip
} from '@mui/material';
import { Line, Pie, Bar } from 'react-chartjs-2';
import { Chart, registerables } from 'chart.js';
import { Refresh, TrendingUp, TrendingDown, AttachMoney } from '@mui/icons-material';
import {
 getTiersOverview,
 getRevenueMetrics,
 getChurnAnalysis,
 getConversionRates
} from '../services/subscriptions';

// Register ChartJS components
Chart.register(...registerables);

function Subscriptions() {
 const [tiersOverview, setTiersOverview] = useState(null);
 const [revenueMetrics, setRevenueMetrics] = useState(null);
 const [churnAnalysis, setChurnAnalysis] = useState(null);
 const [conversionRates, setConversionRates] = useState(null);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState(null);
 const [revenuePeriod, setRevenuePeriod] = useState('30d');
 const [churnPeriod, setChurnPeriod] = useState('90d');

 const fetchSubscriptionData = async () => {
  try {
   setLoading(true);
   setError(null);

   // Fetch data from API endpoints
   const [tiers, revenue, churn, conversions] = await Promise.all([
    getTiersOverview(),
    getRevenueMetrics(revenuePeriod),
    getChurnAnalysis(churnPeriod),
    getConversionRates() // Assuming conversion rates don't need period for now
   ]);

   setTiersOverview(tiers);
   setRevenueMetrics(revenue);
   setChurnAnalysis(churn);
   setConversionRates(conversions);
  } catch (err) {
   console.error('Failed to fetch subscription data:', err);
   setError('Failed to load subscription data. Please try again.');
  } finally {
   setLoading(false);
  }
 };

 useEffect(() => {
  fetchSubscriptionData();

  // Polling interval for real-time updates
  const intervalId = setInterval(fetchSubscriptionData, 60000);
  return () => clearInterval(intervalId);
 }, [revenuePeriod, churnPeriod]); // Rerun if periods change

 // Prepare tiers distribution chart data
 const prepareDistributionData = () => {
  if (!tiersOverview || !tiersOverview.tiers || typeof tiersOverview.tiers !== 'object') {
   console.warn('prepareDistributionData: tiersOverview or tiersOverview.tiers is invalid.', tiersOverview);
   return null;
  }
  const tierLabels = Object.keys(tiersOverview.tiers).map(tier =>
   tier.charAt(0).toUpperCase() + tier.slice(1)
  );
  const tierData = Object.values(tiersOverview.tiers).map(tier => tier.count);
  return {
   labels: tierLabels,
   datasets: [
    {
     data: tierData,
     backgroundColor: ['#4caf50', '#2196f3', '#9c27b0', '#ff9800'], // Added orange for potential 'professional' tier
     borderWidth: 1
    }
   ]
  };
 };

 // Prepare revenue trend chart data
 const prepareRevenueTrendData = () => {
  // Check if trend exists and is an array
  if (!revenueMetrics || !Array.isArray(revenueMetrics.trend) || revenueMetrics.trend.length === 0) {
      console.warn('prepareRevenueTrendData: Invalid or empty trend data.', revenueMetrics?.trend);
      return null; // Return null or default structure
  }
  return {
   labels: revenueMetrics.trend.map(item => item.month),
   datasets: [
    {
     label: 'Monthly Revenue',
     data: revenueMetrics.trend.map(item => item.revenue),
     borderColor: '#2196f3',
     backgroundColor: 'rgba(33, 150, 243, 0.1)',
     fill: true,
    }
   ]
  };
 };

 // Prepare churn rate chart data
 const prepareChurnData = () => {
    // Check if reasons array exists
   if (!churnAnalysis || !Array.isArray(churnAnalysis.reasons) || churnAnalysis.reasons.length === 0) {
       console.warn('prepareChurnData: Invalid or empty reasons data.', churnAnalysis?.reasons);
       return null;
   }
  return {
   labels: churnAnalysis.reasons.map(item => item.reason),
   datasets: [
    {
     label: 'Cancellation Reasons',
     data: churnAnalysis.reasons.map(item => item.count),
     backgroundColor: ['#f44336', '#ff9800', '#ffc107', '#4caf50', '#2196f3'],
     borderColor: 'rgba(255, 255, 255, 0.5)',
     borderWidth: 1
    }
   ]
  };
 };

 // Prepare conversion rates chart data
 const prepareConversionData = () => {
    // Check counts object exists
   if (!conversionRates || !conversionRates.counts || typeof conversionRates.counts !== 'object') {
       console.warn('prepareConversionData: Invalid or missing counts data.', conversionRates?.counts);
       return null;
   }
  const upgradeLabels = ['Free to Basic', 'Free to Premium', 'Basic to Premium'];
  // Use ?? 0 for safety when accessing counts
  const upgradeData = [
   conversionRates.counts.freeToBasic ?? 0,
   conversionRates.counts.freeToPremium ?? 0,
   conversionRates.counts.basicToPremium ?? 0
  ];
  const downgradeLabels = ['Premium to Basic', 'Basic to Free', 'Premium to Free'];
  const downgradeData = [
   conversionRates.counts.premiumToBasic ?? 0,
   conversionRates.counts.basicToFree ?? 0,
   conversionRates.counts.premiumToFree ?? 0
  ];
  return {
   labels: upgradeLabels, // Consider dynamically generating labels if tiers change
   datasets: [
    { label: 'Upgrades', data: upgradeData, backgroundColor: '#4caf50' },
    { label: 'Downgrades', data: downgradeData, backgroundColor: '#f44336' }
   ]
  };
 };

 const commonChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { position: 'top' } }
 };

 // Display loading state only on initial load (when tiersOverview is still null)
 if (loading && !tiersOverview && !revenueMetrics && !churnAnalysis && !conversionRates) {
  return (
   <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
    <CircularProgress />
   </Box>
  );
 }

 // Display error state
 if (error) {
  return (
   <Box sx={{ p: 3 }}>
    <Typography color="error">{error}</Typography>
    <Button variant="outlined" startIcon={<Refresh />} onClick={fetchSubscriptionData} sx={{ mt: 2 }}>
     Retry
    </Button>
   </Box>
  );
 }

 // Main component rendering
 return (
  <Box sx={{ mt: 2 }}>
   <Typography variant="h4" gutterBottom>Subscriptions</Typography>

   {/* Subscription Tiers Overview */}
   <Paper sx={{ p: 3, mb: 3 }}>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
     <Typography variant="h6">Subscription Tiers</Typography>
     <Typography variant="body1">Total Users: {tiersOverview?.totalUsers ?? 0}</Typography>
    </Box>
    <Grid container spacing={3}>
     <Grid item xs={12} md={7}>
      <Box sx={{ height: 300 }}>
       {prepareDistributionData() && <Pie data={prepareDistributionData()} options={{ ...commonChartOptions, plugins: { ...commonChartOptions.plugins, title: { display: true, text: 'User Distribution by Tier' } } }} />}
      </Box>
     </Grid>
     <Grid item xs={12} md={5}>
      <TableContainer component={Paper} variant="outlined">
       <Table>
        <TableHead>
         <TableRow>
          <TableCell>Tier</TableCell>
          <TableCell align="right">Users</TableCell>
          <TableCell align="right">Percentage</TableCell>
         </TableRow>
        </TableHead>
        <TableBody>
         {tiersOverview?.tiers && typeof tiersOverview.tiers === 'object' ?
          Object.entries(tiersOverview.tiers).map(([tier, data]) => (
           <TableRow key={tier}>
            <TableCell sx={{ textTransform: 'capitalize' }}>{tier}</TableCell>
            <TableCell align="right">{data?.count ?? 0}</TableCell>
            <TableCell align="right">{data?.percentage ?? 0}%</TableCell>
           </TableRow>
          )) : (
              <TableRow><TableCell colSpan={3}>No tier data available</TableCell></TableRow>
          )}
        </TableBody>
       </Table>
      </TableContainer>
     </Grid>
    </Grid>
   </Paper>

   {/* Revenue Metrics */}
   <Paper sx={{ p: 3, mb: 3 }}>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
     <Typography variant="h6">Revenue</Typography>
     <FormControl sx={{ width: 120 }} size="small">
      <InputLabel>Period</InputLabel>
      <Select value={revenuePeriod} label="Period" onChange={(e) => setRevenuePeriod(e.target.value)}>
       <MenuItem value="30d">30 days</MenuItem>
       <MenuItem value="90d">90 days</MenuItem>
       <MenuItem value="6m">6 months</MenuItem>
       <MenuItem value="1y">1 year</MenuItem>
      </Select>
     </FormControl>
    </Box>
    <Grid container spacing={3}>
     {/* Card: Current Month Revenue */}
     <Grid item xs={12} md={3}>
      <Card sx={{ height: '100%' }}>
       <CardContent>
        <Typography variant="body2" color="text.secondary">Current Month Revenue</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
         <AttachMoney color="primary" />
         {/* Use ?? 0 before toFixed */}
         <Typography variant="h4">${(revenueMetrics?.total ?? 0).toFixed(2)}</Typography>
        </Box>
        {revenueMetrics && typeof revenueMetrics.total === 'number' && typeof revenueMetrics.recurring === 'number' && (
         <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
          {revenueMetrics.total > 0 && revenueMetrics.recurring >= 0 ? ( // Check recurring >= 0
           (revenueMetrics.recurring === revenueMetrics.total || revenueMetrics.recurring > 0) ? // Show up if 100% or some recurring
           <TrendingUp color="success" fontSize="small" /> :
           <TrendingDown color="error" fontSize="small" /> // Show down if less than 100% but not 0
          ) : ( <TrendingDown color="error" fontSize="small" /> /* Default if total is 0 */ )
          }
          <Typography variant="body2" sx={{ ml: 0.5 }}>
            {/* Ensure total is not zero before division */}
            {revenueMetrics.total > 0 ?
             `${((revenueMetrics.recurring / revenueMetrics.total) * 100).toFixed(1)}% recurring` :
             '0.0% recurring'}
          </Typography>
         </Box>
        )}
       </CardContent>
      </Card>
     </Grid>
     {/* Card: Recurring/One-time */}
     <Grid item xs={12} sm={6} md={3}>
      <Card sx={{ height: '100%' }}>
       <CardContent>
        <Typography variant="body2" color="text.secondary">Recurring Revenue</Typography>
        {/* Use ?? 0 before toFixed */}
        <Typography variant="h4">${(revenueMetrics?.recurring ?? 0).toFixed(2)}</Typography>
        <Divider sx={{ my: 1 }} />
        <Typography variant="body2" color="text.secondary">One-time Revenue</Typography>
        {/* Use ?? 0 before toFixed */}
        <Typography variant="h6">${(revenueMetrics?.oneTime ?? 0).toFixed(2)}</Typography>
       </CardContent>
      </Card>
     </Grid>
     {/* Card: Revenue by Tier/Refunds */}
     <Grid item xs={12} sm={6} md={3}>
      <Card sx={{ height: '100%' }}>
       <CardContent>
        <Typography variant="body2" color="text.secondary">Revenue by Tier</Typography>
        <Typography variant="body1" sx={{ mt: 1 }}>
         {/* Already fixed with ?? 0 */}
         <strong>Basic:</strong> ${(revenueMetrics?.byTier?.basic ?? 0).toFixed(2)}
        </Typography>
        <Typography variant="body1">
         {/* Already fixed with ?? 0 */}
         <strong>Premium:</strong> ${(revenueMetrics?.byTier?.premium ?? 0).toFixed(2)}
        </Typography>
        <Divider sx={{ my: 1 }} />
        <Typography variant="body2" color="text.secondary">Refunds</Typography>
        <Typography variant="body1" color="error.main">
         {/* Already fixed with ?? 0 */}
         -${(revenueMetrics?.refunds ?? 0).toFixed(2)}
        </Typography>
       </CardContent>
      </Card>
     </Grid>
     {/* Card: MoM Growth (Data comes from trend now) */}
     <Grid item xs={12} md={3}>
      <Card sx={{ height: '100%' }}>
       <CardContent>
        <Typography variant="body2" color="text.secondary">Month-over-Month Growth</Typography>
         {/* Ensure trend is an array with at least 2 elements */}
         {revenueMetrics?.trend && Array.isArray(revenueMetrics.trend) && revenueMetrics.trend.length >= 2 ? (() => {
            const current = revenueMetrics.trend[revenueMetrics.trend.length - 1]?.revenue;
            const previous = revenueMetrics.trend[revenueMetrics.trend.length - 2]?.revenue;

            // Check if both values are valid numbers
            if (typeof current !== 'number' || typeof previous !== 'number') {
              return <Typography variant="body2" sx={{ mt: 1 }}>N/A</Typography>;
            }

            const growthPercentage = previous > 0 ? (((current - previous) / previous) * 100) : (current > 0 ? Infinity : 0); // Handle division by zero or growth from zero

            return (
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                {current > previous ? <TrendingUp color="success" /> : <TrendingDown color="error" />}
                <Typography variant="h4" sx={{ ml: 1 }}>
                  {isFinite(growthPercentage) ? `${growthPercentage.toFixed(1)}%` : (current > 0 ? '+Inf%' : '0.0%')}
                </Typography>
              </Box>
            );
         })() : (
            <Typography variant="body2" sx={{ mt: 1 }}>N/A</Typography>
         )}
       </CardContent>
      </Card>
     </Grid>
     {/* Chart: Monthly Revenue Trend */}
     <Grid item xs={12}>
      <Box sx={{ height: 300, mt: 2 }}>
       {prepareRevenueTrendData() && <Line data={prepareRevenueTrendData()} options={{ ...commonChartOptions, scales: { y: { beginAtZero: true, title: { display: true, text: 'Revenue ($)' } } }, plugins: { ...commonChartOptions.plugins, title: { display: true, text: 'Monthly Revenue Trend' } } }} />}
      </Box>
     </Grid>
    </Grid>
   </Paper>

   {/* Churn Analysis */}
   <Paper sx={{ p: 3, mb: 3 }}>
     <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
       <Typography variant="h6">Churn Analysis</Typography>
       <FormControl sx={{ width: 120 }} size="small">
         <InputLabel>Period</InputLabel>
         <Select value={churnPeriod} label="Period" onChange={(e) => setChurnPeriod(e.target.value)}>
           <MenuItem value="30d">30 days</MenuItem>
           <MenuItem value="90d">90 days</MenuItem>
           <MenuItem value="6m">6 months</MenuItem>
           <MenuItem value="1y">1 year</MenuItem>
         </Select>
       </FormControl>
     </Box>
     <Grid container spacing={3}>
       {/* Card: Churn Rate */}
       <Grid item xs={12} md={5}>
         <Card sx={{ mb: 2 }}>
           <CardContent>
             <Typography variant="h6" gutterBottom>Churn Rate</Typography>
             <Box sx={{ display: 'flex', alignItems: 'center' }}>
               <Typography variant="h3" color={(churnAnalysis?.churnRate ?? 0) > 5 ? "error.main" : "success.main"}>
                 {(churnAnalysis?.churnRate ?? 0)}% {/* Removed unnecessary toFixed */}
               </Typography>
             </Box>
             <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
               {(churnAnalysis?.canceledSubscriptions ?? 0)} cancellations out of {(churnAnalysis?.totalSubscriptionsAtStart ?? 0)} subscriptions
             </Typography>
           </CardContent>
         </Card>
         {/* Card: Churn by Tier */}
         <Card>
           <CardContent>
             <Typography variant="h6" gutterBottom>Churn by Tier</Typography>
             {churnAnalysis?.churnByTier ? (
               <>
                 <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                   <Typography variant="body1">Basic:</Typography>
                   <Typography variant="body1">{(churnAnalysis.churnByTier.basic ?? 0)} users</Typography>
                 </Box>
                 <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                   <Typography variant="body1">Premium:</Typography>
                   <Typography variant="body1">{(churnAnalysis.churnByTier.premium ?? 0)} users</Typography>
                 </Box>
               </>
             ) : <Typography variant="body2">No data</Typography>}
           </CardContent>
         </Card>
       </Grid>
       {/* Chart: Cancellation Reasons */}
       <Grid item xs={12} md={7}>
         <Card sx={{ height: '100%' }}>
           <CardContent>
             <Typography variant="h6" gutterBottom>Cancellation Reasons</Typography>
             <Box sx={{ height: 250 }}>
               {prepareChurnData() && <Pie data={prepareChurnData()} options={{ ...commonChartOptions, plugins: { ...commonChartOptions.plugins, legend: { position: 'right' } } }} />}
             </Box>
           </CardContent>
         </Card>
       </Grid>
     </Grid>
   </Paper>

   {/* Conversion Analysis */}
   <Paper sx={{ p: 3 }}>
    <Typography variant="h6" gutterBottom>Conversion Rates</Typography>
    <Grid container spacing={3}>
     {/* Chart: Plan Changes */}
     <Grid item xs={12} md={7}>
      <Box sx={{ height: 350 }}>
       {prepareConversionData() && <Bar data={prepareConversionData()} options={{ ...commonChartOptions, scales: { y: { beginAtZero: true, title: { display: true, text: 'Number of Users' } } }, plugins: { ...commonChartOptions.plugins, title: { display: true, text: 'Subscription Plan Changes' } } }} />}
      </Box>
     </Grid>
     {/* Card: Conversion Percentages */}
     <Grid item xs={12} md={5}>
      <Card sx={{ height: '100%' }}>
       <CardContent>
        <Typography variant="subtitle1" gutterBottom>Conversion Percentages</Typography>
        {/* Upgrades */}
        <Box sx={{ mt: 2 }}>
         <Typography variant="body2" gutterBottom><strong>Upgrades</strong></Typography>
          {conversionRates?.percentages ? (
            <>
             <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
               <Typography variant="body2">Free to Basic:</Typography>
               <Chip label={`${(conversionRates.percentages.freeToBasic ?? 0)}%`} color="success" size="small"/>
             </Box>
             <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
               <Typography variant="body2">Free to Premium:</Typography>
               <Chip label={`${(conversionRates.percentages.freeToPremium ?? 0)}%`} color="success" size="small"/>
             </Box>
             <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
               <Typography variant="body2">Basic to Premium:</Typography>
               <Chip label={`${(conversionRates.percentages.basicToPremium ?? 0)}%`} color="success" size="small"/>
             </Box>
            </>
          ) : <Typography variant="body2">No data</Typography>}
        </Box>
        {/* Downgrades */}
        <Box sx={{ mt: 3 }}>
         <Typography variant="body2" gutterBottom><strong>Downgrades</strong></Typography>
         {conversionRates?.percentages ? (
           <>
             <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
               <Typography variant="body2">Premium to Basic:</Typography>
               <Chip label={`${(conversionRates.percentages.premiumToBasic ?? 0)}%`} color="error" size="small"/>
             </Box>
             <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
               <Typography variant="body2">Basic to Free:</Typography>
               <Chip label={`${(conversionRates.percentages.basicToFree ?? 0)}%`} color="error" size="small"/>
             </Box>
             <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
               <Typography variant="body2">Premium to Free:</Typography>
               <Chip label={`${(conversionRates.percentages.premiumToFree ?? 0)}%`} color="error" size="small"/>
             </Box>
           </>
          ): <Typography variant="body2">No data</Typography>}
        </Box>
        {/* Total */}
        <Box sx={{ mt: 3 }}>
         <Typography variant="body2">
           <strong>Total Conversions:</strong> {conversionRates?.totalConversions ?? 0}
         </Typography>
        </Box>
       </CardContent>
      </Card>
     </Grid>
    </Grid>
   </Paper>
  </Box>
 );
}

export default Subscriptions;