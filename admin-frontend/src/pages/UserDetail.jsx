import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  Divider,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  CircularProgress,
  Alert,
  List,
  ListItem,
  ListItemText,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import {
  ArrowBack,
  Person,
  Email,
  CalendarToday,
  AccessTime,
  RestaurantMenu,
  Favorite,
  History,
  Diamond,
  Refresh
} from '@mui/icons-material';
import { format } from 'date-fns';
import { getUserDetails, updateUserSubscription, resetUserLimits } from '../services/users';
import { Bar } from 'react-chartjs-2';
import { Chart, registerables } from 'chart.js';

// Register ChartJS components
Chart.register(...registerables);

function UserDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTier, setSelectedTier] = useState('');
  const [updateLoading, setUpdateLoading] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [updateError, setUpdateError] = useState(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetError, setResetError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tabValue, setTabValue] = useState(0);

  const fetchUserData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await getUserDetails(id);
      setUserData(data);
      
      // Initialize selectedTier from user data
      if (data?.user?.subscriptions?.length > 0) {
        setSelectedTier(data.user.subscriptions[0].tier || 'free');
      } else {
        setSelectedTier('free');
      }
      
    } catch (err) {
      console.error('Failed to fetch user details:', err);
      setError('Failed to load user details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserData();
  }, [id]);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleTierChange = (event) => {
    setSelectedTier(event.target.value);
  };

  const handleUpdateSubscription = async () => {
    try {
      setUpdateLoading(true);
      setUpdateError(null);
      setUpdateSuccess(false);
      
      await updateUserSubscription(id, selectedTier);
      
      setUpdateSuccess(true);
      fetchUserData(); // Refresh user data after update
      
      setTimeout(() => {
        setUpdateSuccess(false);
      }, 3000);
      
    } catch (err) {
      console.error('Failed to update subscription:', err);
      setUpdateError('Failed to update subscription. Please try again.');
    } finally {
      setUpdateLoading(false);
    }
  };

  const handleResetLimits = async () => {
    try {
      setResetLoading(true);
      setResetError(null);
      setResetSuccess(false);
      
      await resetUserLimits(id);
      
      setResetSuccess(true);
      fetchUserData(); // Refresh user data after reset
      
      setTimeout(() => {
        setResetSuccess(false);
      }, 3000);
      
    } catch (err) {
      console.error('Failed to reset usage limits:', err);
      setResetError('Failed to reset usage limits. Please try again.');
    } finally {
      setResetLoading(false);
      setDialogOpen(false);
    }
  };

  const getTierChipColor = (tier) => {
    switch (tier) {
      case 'premium': return 'success';
      case 'basic': return 'primary';
      case 'free': return 'default';
      default: return 'default';
    }
  };

  const getStatusChipColor = (status) => {
    switch (status) {
      case 'active': return 'success';
      case 'canceled': return 'error';
      case 'past_due': return 'warning';
      case 'trialing': return 'info';
      default: return 'default';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    try {
      return format(new Date(dateString), 'PPP p');
    } catch (error) {
      console.error('Error formatting date:', error);
      return dateString;
    }
  };

  // Prepare usage chart data
  const prepareUsageData = () => {
    if (!userData?.usage || userData.usage.length === 0) return null;
    
    const labels = userData.usage.map(item => {
      try {
        const date = new Date(item.period_start);
        return format(date, 'MMM yyyy');
      } catch (error) {
        return item.period_start;
      }
    });
    
    return {
      labels,
      datasets: [
        {
          label: 'Recipe Generations',
          data: userData.usage.map(item => item.recipe_generations || 0),
          backgroundColor: '#4caf50',
        }
      ]
    };
  };

  if (loading) {
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
          onClick={fetchUserData}
          sx={{ mt: 2 }}
        >
          Retry
        </Button>
      </Box>
    );
  }

  if (!userData || !userData.user) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">User not found</Alert>
        <Button 
          variant="outlined" 
          startIcon={<ArrowBack />} 
          onClick={() => navigate('/users')}
          sx={{ mt: 2 }}
        >
          Back to Users
        </Button>
      </Box>
    );
  }

  const { user, stats, activity, usage } = userData;

  return (
    <Box sx={{ mt: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Button 
          variant="outlined" 
          startIcon={<ArrowBack />} 
          onClick={() => navigate('/users')}
          sx={{ mr: 2 }}
        >
          Back
        </Button>
        <Typography variant="h4">User Details</Typography>
      </Box>
      
      {/* Basic Info Card */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Person sx={{ fontSize: 40, mr: 2, color: 'primary.main' }} />
              <Typography variant="h5">{user.email}</Typography>
            </Box>
            
            <List dense>
              <ListItem>
                <ListItemText
                  primary="User ID"
                  secondary={user.id}
                />
              </ListItem>
              <ListItem>
                <Email sx={{ mr: 1, fontSize: 'small', color: 'text.secondary' }} />
                <ListItemText
                  primary="Email Confirmed"
                  secondary={user.email_confirmed_at ? 'Yes' : 'No'}
                />
              </ListItem>
              <ListItem>
                <CalendarToday sx={{ mr: 1, fontSize: 'small', color: 'text.secondary' }}/>
                <ListItemText
                  primary="Registered"
                  secondary={formatDate(user.created_at)}
                />
              </ListItem>
              <ListItem>
                <AccessTime sx={{ mr: 1, fontSize: 'small', color: 'text.secondary' }} />
                <ListItemText
                  primary="Last Login"
                  secondary={formatDate(user.last_sign_in_at)}
                />
              </ListItem>
            </List>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" gutterBottom>Subscription</Typography>
                
                {user.subscriptions && user.subscriptions.length > 0 ? (
                  <>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2">Current Tier:</Typography>
                      <Chip 
                        label={user.subscriptions[0].tier} 
                        color={getTierChipColor(user.subscriptions[0].tier)}
                        size="small"
                      />
                    </Box>
                    
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2">Status:</Typography>
                      <Chip 
                        label={user.subscriptions[0].status} 
                        color={getStatusChipColor(user.subscriptions[0].status)}
                        size="small"
                      />
                    </Box>
                    
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2">Current Period End:</Typography>
                      <Typography variant="body2">{formatDate(user.subscriptions[0].current_period_end)}</Typography>
                    </Box>
                    
                    {user.subscriptions[0].cancel_at_period_end && (
                      <Alert severity="warning" sx={{ mt: 1 }}>
                        Will cancel at period end
                      </Alert>
                    )}
                  </>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No active subscription
                  </Typography>
                )}
                
                <Divider sx={{ my: 2 }} />
                
                <Typography variant="h6" gutterBottom>Update Subscription</Typography>
                
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Tier</InputLabel>
                      <Select
                        value={selectedTier}
                        label="Tier"
                        onChange={handleTierChange}
                      >
                        <MenuItem value="free">Free</MenuItem>
                        <MenuItem value="basic">Basic</MenuItem>
                        <MenuItem value="premium">Premium</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Button
                      variant="contained"
                      color="primary"
                      fullWidth
                      onClick={handleUpdateSubscription}
                      disabled={updateLoading}
                    >
                      {updateLoading ? 'Updating...' : 'Update Subscription'}
                    </Button>
                  </Grid>
                </Grid>
                
                {updateSuccess && (
                  <Alert severity="success" sx={{ mt: 2 }}>
                    Subscription updated successfully
                  </Alert>
                )}
                
                {updateError && (
                  <Alert severity="error" sx={{ mt: 2 }}>
                    {updateError}
                  </Alert>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Paper>
      
      {/* Stats and Usage Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          variant="fullWidth"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="Statistics" />
          <Tab label="Activity" />
          <Tab label="Usage" />
        </Tabs>
        
        {/* Stats Tab */}
        {tabValue === 0 && (
          <Box sx={{ p: 3 }}>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <RestaurantMenu sx={{ color: 'primary.main', mr: 1 }} />
                      <Typography variant="h6">Recipes</Typography>
                    </Box>
                    <Typography variant="h4">{stats?.recipeCount || 0}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <Favorite sx={{ color: 'error.main', mr: 1 }} />
                      <Typography variant="h6">Favorites</Typography>
                    </Box>
                    <Typography variant="h4">{stats?.favoriteCount || 0}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6">Usage Limits</Typography>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => setDialogOpen(true)}
                        disabled={resetLoading}
                      >
                        Reset Limits
                      </Button>
                    </Box>
                    
                    {resetSuccess && (
                      <Alert severity="success" sx={{ mb: 2 }}>
                        Usage limits reset successfully
                      </Alert>
                    )}
                    
                    {resetError && (
                      <Alert severity="error" sx={{ mb: 2 }}>
                        {resetError}
                      </Alert>
                    )}
                    
                    {userData?.usage && userData.usage.length > 0 ? (
                      <Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                          <Typography variant="body2">Current Period:</Typography>
                          <Typography variant="body2">
                            {formatDate(userData.usage[0].period_start)} - {formatDate(userData.usage[0].period_end)}
                          </Typography>
                        </Box>
                        
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                          <Typography variant="body2">Recipe Generations:</Typography>
                          <Typography variant="body2">
                            {userData.usage[0].recipe_generations || 0}
                          </Typography>
                        </Box>
                        
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                          <Typography variant="body2">Chat Messages Today:</Typography>
                          <Typography variant="body2">
                            {userData.usage[0].chat_messages_today || 0}
                          </Typography>
                        </Box>
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No usage data available
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Box>
        )}
        
        {/* Activity Tab */}
        {tabValue === 1 && (
          <Box sx={{ p: 3 }}>
            {activity && activity.length > 0 ? (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Action</TableCell>
                      <TableCell>Details</TableCell>
                      <TableCell>Timestamp</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {activity.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Chip 
                            label={item.action_type} 
                            size="small"
                            color={
                              item.action_type === 'recipe_generation' ? 'success' :
                              item.action_type === 'login' ? 'primary' : 
                              'default'
                            }
                          />
                        </TableCell>
                        <TableCell>{item.details || '-'}</TableCell>
                        <TableCell>{formatDate(item.created_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Typography variant="body1" color="text.secondary" align="center" sx={{ py: 4 }}>
                No activity data available
              </Typography>
            )}
          </Box>
        )}
        
        {/* Usage Tab */}
        {tabValue === 2 && (
          <Box sx={{ p: 3 }}>
            {usage && usage.length > 0 ? (
              <>
                <Box sx={{ height: 300, mb: 3 }}>
                  <Bar 
                    data={prepareUsageData()} 
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          position: 'top',
                        },
                        title: {
                          display: true,
                          text: 'Recipe Generations by Period'
                        }
                      },
                      scales: {
                        y: {
                          beginAtZero: true,
                          title: {
                            display: true,
                            text: 'Count'
                          }
                        }
                      }
                    }} 
                  />
                </Box>
                
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Period</TableCell>
                        <TableCell align="right">Recipe Generations</TableCell>
                        <TableCell align="right">Chat Messages</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {usage.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            {formatDate(item.period_start).split(',')[0]} - {formatDate(item.period_end).split(',')[0]}
                          </TableCell>
                          <TableCell align="right">{item.recipe_generations || 0}</TableCell>
                          <TableCell align="right">{item.chat_messages || 0}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            ) : (
              <Typography variant="body1" color="text.secondary" align="center" sx={{ py: 4 }}>
                No usage data available
              </Typography>
            )}
          </Box>
        )}
      </Paper>
      
      {/* Reset Confirmation Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
      >
        <DialogTitle>Reset Usage Limits</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to reset the usage limits for this user? 
            This will reset their recipe generations and chat message counts for the current period.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={resetLoading}>Cancel</Button>
          <Button onClick={handleResetLimits} color="primary" disabled={resetLoading}>
            {resetLoading ? 'Resetting...' : 'Reset'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default UserDetail;