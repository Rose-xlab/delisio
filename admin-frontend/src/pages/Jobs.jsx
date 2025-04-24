import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Paper, 
  Typography, 
  Grid, 
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import { Line } from 'react-chartjs-2';
import { Chart, registerables } from 'chart.js';
import { ExpandMore, Refresh, Replay, Cancel } from '@mui/icons-material';
import { getQueueStatus, getFailedJobs, retryJob, cancelJob, getPerformanceMetrics } from '../services/jobs';
import { format, formatDistanceToNow } from 'date-fns';

// Register ChartJS components
Chart.register(...registerables);

// Queue health indicator component
const QueueHealthIndicator = ({ status, score }) => {
    const getColor = () => {
      if (score >= 90) return '#4caf50';
      if (score >= 70) return '#ff9800';
      return '#f44336';
    };
  
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
        <Box sx={{ width: '100%', mr: 1 }}>
          <LinearProgress 
            variant="determinate" 
            value={score} 
            sx={{ 
              height: 10, 
              borderRadius: 5,
              backgroundColor: '#e0e0e0',
              '& .MuiLinearProgress-bar': {
                backgroundColor: getColor()
              }
            }}
          />
        </Box>
      
        <Box sx={{ minWidth: 35 }}>
          <Typography variant="body2" color="text.secondary">
            {score}%
          </Typography>
        </Box>
      </Box>
    );
  };
  


function Jobs() {
  const [queueStatus, setQueueStatus] = useState(null);
  const [failedJobs, setFailedJobs] = useState([]);
  const [performanceMetrics, setPerformanceMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedQueue, setSelectedQueue] = useState('all');
  const [period, setPeriod] = useState('24h');
  const [tabValue, setTabValue] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalFailedJobs, setTotalFailedJobs] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [selectedAction, setSelectedAction] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch queue status
      const status = await getQueueStatus();
      setQueueStatus(status);
      
      // Fetch failed jobs
      const params = {
        page: page + 1, // API uses 1-based indexing
        limit: rowsPerPage,
        queue: selectedQueue
      };
      
      const failedJobsResponse = await getFailedJobs(params);
      setFailedJobs(failedJobsResponse.jobs || []);
      setTotalFailedJobs(failedJobsResponse.pagination?.total || 0);
      
      // Fetch performance metrics
      const metrics = await getPerformanceMetrics(selectedQueue, period);
      setPerformanceMetrics(metrics);
    } catch (err) {
      console.error('Failed to fetch jobs data:', err);
      setError('Failed to load jobs data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    
    // Set up polling for real-time updates
    const intervalId = setInterval(fetchData, 30000);
    return () => clearInterval(intervalId);
  }, [selectedQueue, period, page, rowsPerPage]);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleQueueChange = (event) => {
    setSelectedQueue(event.target.value);
    setPage(0); // Reset to first page when queue changes
  };

  const handlePeriodChange = (event) => {
    setPeriod(event.target.value);
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleJobAction = (jobId, action) => {
    setSelectedJobId(jobId);
    setSelectedAction(action);
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setSelectedJobId(null);
    setSelectedAction(null);
  };

  const executeJobAction = async () => {
    if (!selectedJobId || !selectedAction) return;
    
    setActionLoading(true);
    try {
      if (selectedAction === 'retry') {
        await retryJob(selectedJobId, selectedQueue);
      } else if (selectedAction === 'cancel') {
        await cancelJob(selectedJobId, selectedQueue);
      }
      // Refresh data after action
      fetchData();
    } catch (err) {
      console.error(`Failed to ${selectedAction} job:`, err);
      setError(`Failed to ${selectedAction} job. ${err.message}`);
    } finally {
      setActionLoading(false);
      setDialogOpen(false);
    }
  };

  // Prepare performance chart data
  const prepareChartData = () => {
    if (!performanceMetrics) return null;
    
    // For multi-queue view, create multiple datasets
    if (selectedQueue === 'all' && typeof performanceMetrics === 'object') {
      const labels = [];
      const datasets = [];
      
      // Get all unique timestamps across queues
      Object.values(performanceMetrics).forEach(queueMetrics => {
        if (queueMetrics.timestamps) {
          queueMetrics.timestamps.forEach(timestamp => {
            if (!labels.includes(timestamp)) {
              labels.push(timestamp);
            }
          });
        }
      });
      
      // Sort labels
      labels.sort();
      
      // Create a dataset for each queue
      const colors = {
        recipe: '#4caf50',
        image: '#2196f3',
        chat: '#ff9800'
      };
      
      Object.entries(performanceMetrics).forEach(([queueName, queueMetrics]) => {
        // Map throughput data to timestamps
        const data = labels.map(label => {
          const index = queueMetrics.timestamps?.indexOf(label);
          return index !== -1 ? queueMetrics.throughput[index] : null;
        });
        
        datasets.push({
          label: `${queueName.charAt(0).toUpperCase() + queueName.slice(1)} Queue`,
          data,
          borderColor: colors[queueName] || '#9e9e9e',
          backgroundColor: colors[queueName] ? `${colors[queueName]}33` : '#9e9e9e33',
          fill: true,
        });
      });
      
      return {
        labels,
        datasets
      };
    }
    
    // For single queue view
    return {
      labels: performanceMetrics.timestamps || [],
      datasets: [
        {
          label: 'Jobs per minute',
          data: performanceMetrics.throughput || [],
          borderColor: '#2196f3',
          backgroundColor: 'rgba(33, 150, 243, 0.1)',
          fill: true,
        }
      ]
    };
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Jobs per minute'
        }
      },
      x: {
        title: {
          display: true,
          text: 'Time'
        }
      }
    },
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Queue Performance'
      }
    }
  };

  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="h4" gutterBottom>
        Jobs & Queues
      </Typography>
      
      <Tabs 
        value={tabValue} 
        onChange={handleTabChange}
        sx={{ mb: 3 }}
      >
        <Tab label="Overview" />
        <Tab label="Failed Jobs" />
        <Tab label="Performance" />
      </Tabs>
      
      {loading && !queueStatus ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Box sx={{ p: 3 }}>
          <Typography color="error">{error}</Typography>
          <Button 
            variant="outlined" 
            startIcon={<Refresh />} 
            onClick={fetchData}
            sx={{ mt: 2 }}
          >
            Retry
          </Button>
        </Box>
      ) : (
        <>
          {/* Overview Tab */}
          {tabValue === 0 && queueStatus && (
            <Grid container spacing={3}>
              {Object.entries(queueStatus).map(([queueName, queueData]) => (
                <Grid item xs={12} md={4} key={queueName}>
                  <Paper sx={{ p: 2, height: '100%' }}>
                    <Typography variant="h6" gutterBottom sx={{ textTransform: 'capitalize' }}>
                      {queueName} Queue
                    </Typography>
                    
                    <Typography variant="body2" gutterBottom>
                      Health Score
                    </Typography>
                    <QueueHealthIndicator 
                      status={queueData.health?.status} 
                      score={queueData.health?.score || 0} 
                    />
                    
                    <Box sx={{ mt: 3 }}>
                      <Typography variant="body2" gutterBottom>
                        Jobs
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">Active</Typography>
                          <Typography variant="h6">{queueData.counts?.active || 0}</Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">Waiting</Typography>
                          <Typography variant="h6">{queueData.counts?.waiting || 0}</Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">Completed</Typography>
                          <Typography variant="h6">{queueData.counts?.completed || 0}</Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">Failed</Typography>
                          <Typography variant="h6">{queueData.counts?.failed || 0}</Typography>
                        </Grid>
                      </Grid>
                    </Box>
                    
                    <Box sx={{ mt: 3 }}>
                      <Typography variant="body2" gutterBottom>
                        Performance
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Throughput
                      </Typography>
                      <Typography variant="h6">
                        {queueData.performance?.throughputPerMinute || 0} jobs/min
                      </Typography>
                    </Box>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          )}
          
          {/* Failed Jobs Tab */}
          {tabValue === 1 && (
            <Box>
              <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <FormControl sx={{ minWidth: 200 }}>
                  <InputLabel>Queue</InputLabel>
                  <Select
                    value={selectedQueue}
                    label="Queue"
                    onChange={handleQueueChange}
                  >
                    <MenuItem value="all">All Queues</MenuItem>
                    <MenuItem value="recipe">Recipe Queue</MenuItem>
                    <MenuItem value="image">Image Queue</MenuItem>
                    <MenuItem value="chat">Chat Queue</MenuItem>
                  </Select>
                </FormControl>
                
                <Button 
                  variant="outlined" 
                  startIcon={<Refresh />} 
                  onClick={fetchData}
                >
                  Refresh
                </Button>
              </Box>
              
              <Paper sx={{ width: '100%', overflow: 'hidden' }}>
                {loading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                    <CircularProgress />
                  </Box>
                ) : (
                  <>
                    <TableContainer sx={{ maxHeight: 440 }}>
                      <Table stickyHeader>
                        <TableHead>
                          <TableRow>
                            <TableCell>Job ID</TableCell>
                            <TableCell>Queue</TableCell>
                            <TableCell>Failed At</TableCell>
                            <TableCell>Reason</TableCell>
                            <TableCell>Attempts</TableCell>
                            <TableCell align="right">Actions</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {failedJobs.map((job) => (
                            <TableRow key={job.id} hover>
                              <TableCell>{job.id}</TableCell>
                              <TableCell sx={{ textTransform: 'capitalize' }}>{job.queue}</TableCell>
                              <TableCell>
                                {job.failedAt ? formatDistanceToNow(new Date(job.failedAt), { addSuffix: true }) : 'Unknown'}
                              </TableCell>
                              <TableCell>
                                <Typography noWrap sx={{ maxWidth: 300 }}>
                                  {job.failedReason || 'Unknown error'}
                                </Typography>
                              </TableCell>
                              <TableCell>{job.attemptsMade || 0}</TableCell>
                              <TableCell align="right">
                                <Button
                                  variant="outlined"
                                  size="small"
                                  color="primary"
                                  startIcon={<Replay />}
                                  onClick={() => handleJobAction(job.id, 'retry')}
                                  sx={{ mr: 1 }}
                                >
                                  Retry
                                </Button>
                                <Button
                                  variant="outlined"
                                  size="small"
                                  color="error"
                                  startIcon={<Cancel />}
                                  onClick={() => handleJobAction(job.id, 'cancel')}
                                >
                                  Cancel
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                          {failedJobs.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={6} align="center">
                                No failed jobs found
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>
                    <TablePagination
                      rowsPerPageOptions={[10, 25, 50]}
                      component="div"
                      count={totalFailedJobs}
                      rowsPerPage={rowsPerPage}
                      page={page}
                      onPageChange={handleChangePage}
                      onRowsPerPageChange={handleChangeRowsPerPage}
                    />
                  </>
                )}
              </Paper>
              
              {failedJobs.length > 0 && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    Job Details
                  </Typography>
                  
                  {failedJobs.map((job) => (
                    <Accordion key={job.id} sx={{ mb: 1 }}>
                      <AccordionSummary
                        expandIcon={<ExpandMore />}
                        aria-controls={`panel-${job.id}-content`}
                        id={`panel-${job.id}-header`}
                      >
                        <Typography>{job.id} - {job.failedReason?.substring(0, 50) || 'Unknown error'}...</Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Typography variant="subtitle2">Failed Reason:</Typography>
                        <Typography variant="body2" sx={{ mb: 2, whiteSpace: 'pre-wrap' }}>
                          {job.failedReason}
                        </Typography>
                        
                        <Typography variant="subtitle2">Stack Trace:</Typography>
                        <Typography variant="body2" sx={{ mb: 2, whiteSpace: 'pre-wrap' }}>
                          {job.stacktrace?.[0] || 'No stack trace available'}
                        </Typography>
                        
                        <Typography variant="subtitle2">Job Data:</Typography>
                        <Typography variant="body2" component="pre" sx={{ 
                          mb: 2, 
                          backgroundColor: '#f5f5f5', 
                          p: 1, 
                          overflowX: 'auto',
                          whiteSpace: 'pre-wrap'
                        }}>
                          {JSON.stringify(job.data, null, 2)}
                        </Typography>
                      </AccordionDetails>
                    </Accordion>
                  ))}
                </Box>
              )}
            </Box>
          )}
          
          {/* Performance Tab */}
          {tabValue === 2 && (
            <Box>
              <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <FormControl sx={{ minWidth: 200 }}>
                    <InputLabel>Queue</InputLabel>
                    <Select
                      value={selectedQueue}
                      label="Queue"
                      onChange={handleQueueChange}
                    >
                      <MenuItem value="all">All Queues</MenuItem>
                      <MenuItem value="recipe">Recipe Queue</MenuItem>
                      <MenuItem value="image">Image Queue</MenuItem>
                      <MenuItem value="chat">Chat Queue</MenuItem>
                    </Select>
                  </FormControl>
                  
                  <FormControl sx={{ minWidth: 120 }}>
                    <InputLabel>Period</InputLabel>
                    <Select
                      value={period}
                      label="Period"
                      onChange={handlePeriodChange}
                    >
                      <MenuItem value="1h">1 hour</MenuItem>
                      <MenuItem value="6h">6 hours</MenuItem>
                      <MenuItem value="24h">24 hours</MenuItem>
                      <MenuItem value="7d">7 days</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
                
                <Button 
                  variant="outlined" 
                  startIcon={<Refresh />} 
                  onClick={fetchData}
                >
                  Refresh
                </Button>
              </Box>
              
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Queue Performance
                </Typography>
                
                {loading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                    <CircularProgress />
                  </Box>
                ) : performanceMetrics ? (
                  <Box sx={{ height: 400 }}>
                    <Line data={prepareChartData()} options={chartOptions} />
                  </Box>
                ) : (
                  <Typography color="text.secondary">
                    No performance data available
                  </Typography>
                )}
              </Paper>
              
              <Grid container spacing={3} sx={{ mt: 1 }}>
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="h6" gutterBottom>
                      Processing Time
                    </Typography>
                    
                    {performanceMetrics ? (
                      <Box>
                        <Typography variant="body2" gutterBottom>
                          Average Processing Time
                        </Typography>
                        <Typography variant="h4">
                          {performanceMetrics.avgProcessingTimeMs || 0} ms
                        </Typography>
                        
                        <Typography variant="body2" gutterBottom sx={{ mt: 2 }}>
                          Average Waiting Time
                        </Typography>
                        <Typography variant="h4">
                          {performanceMetrics.avgWaitingTimeMs || 0} ms
                        </Typography>
                      </Box>
                    ) : (
                      <Typography color="text.secondary">
                        No processing time data available
                      </Typography>
                    )}
                  </Paper>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="h6" gutterBottom>
                      Success Rate
                    </Typography>
                    
                    {performanceMetrics ? (
                      <Box>
                        <Typography variant="body2" gutterBottom>
                          Success Rate
                        </Typography>
                        <Typography variant="h4">
                          {performanceMetrics.successRate || 0}%
                        </Typography>
                        
                        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}>
                          <Box>
                            <Typography variant="body2" gutterBottom>
                              Completed Jobs
                            </Typography>
                            <Typography variant="h6">
                              {performanceMetrics.completed || 0}
                            </Typography>
                          </Box>
                          
                          <Box>
                            <Typography variant="body2" gutterBottom>
                              Failed Jobs
                            </Typography>
                            <Typography variant="h6">
                              {performanceMetrics.failed || 0}
                            </Typography>
                          </Box>
                          
                          <Box>
                            <Typography variant="body2" gutterBottom>
                              Throughput (hourly)
                            </Typography>
                            <Typography variant="h6">
                              {performanceMetrics.throughputPerHour || 0}
                            </Typography>
                          </Box>
                        </Box>
                      </Box>
                    ) : (
                      <Typography color="text.secondary">
                        No success rate data available
                      </Typography>
                    )}
                  </Paper>
                </Grid>
              </Grid>
            </Box>
          )}
        </>
      )}
      
      {/* Confirmation Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={handleDialogClose}
      >
        <DialogTitle>
          {selectedAction === 'retry' ? 'Retry Job' : 'Cancel Job'}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {selectedAction === 'retry' 
              ? 'Are you sure you want to retry this job? This will add it back to the queue.'
              : 'Are you sure you want to cancel this job? This cannot be undone.'}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClose} disabled={actionLoading}>
            No
          </Button>
          <Button 
            onClick={executeJobAction} 
            variant="contained" 
            color={selectedAction === 'retry' ? 'primary' : 'error'}
            disabled={actionLoading}
          >
            {actionLoading ? 'Processing...' : 'Yes'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default Jobs;