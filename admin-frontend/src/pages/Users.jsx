import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Box, 
  Paper, 
  Typography, 
  TextField, 
  InputAdornment, 
  Grid, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  CircularProgress,
  Chip
} from '@mui/material';
import { Search, Refresh } from '@mui/icons-material';
import { format } from 'date-fns';
import { getUsers } from '../services/users';

function Users() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [tier, setTier] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalUsers, setTotalUsers] = useState(0);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = {
        page: page + 1, // API uses 1-based indexing
        limit: rowsPerPage,
        search: search || undefined,
        tier: tier || undefined,
        sortBy,
        sortDir
      };
      
      const response = await getUsers(params);
      setUsers(response.users || []);
      setTotalUsers(response.pagination?.total || 0);
    } catch (err) {
      console.error('Failed to fetch users:', err);
      setError('Failed to load users. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page, rowsPerPage, sortBy, sortDir]);

  const handleSearch = () => {
    setPage(0); // Reset to first page when searching
    fetchUsers();
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleViewUser = (userId) => {
    navigate(`/users/${userId}`);
  };

  const handleSort = (column) => {
    if (sortBy === column) {
      // Toggle direction if already sorting by this column
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      // New column, default to descending
      setSortBy(column);
      setSortDir('desc');
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

  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="h4" gutterBottom>
        Users
      </Typography>
      
      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={4}>
            <TextField
              fullWidth
              label="Search"
              variant="outlined"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyPress={handleKeyPress}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <Search />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth>
              <InputLabel>Subscription Tier</InputLabel>
              <Select
                value={tier}
                label="Subscription Tier"
                onChange={(e) => setTier(e.target.value)}
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="free">Free</MenuItem>
                <MenuItem value="basic">Basic</MenuItem>
                <MenuItem value="premium">Premium</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={12} md={5}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button 
                variant="contained" 
                onClick={handleSearch}
                sx={{ mr: 1 }}
              >
                Search
              </Button>
              <Button 
                variant="outlined" 
                startIcon={<Refresh />}
                onClick={() => {
                  setSearch('');
                  setTier('');
                  setPage(0);
                  fetchUsers();
                }}
              >
                Reset
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>
      
      {/* Users Table */}
      <Paper sx={{ width: '100%', overflow: 'hidden' }}>
        {loading && !users.length ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Box sx={{ p: 3 }}>
            <Typography color="error">{error}</Typography>
          </Box>
        ) : (
          <>
            <TableContainer sx={{ maxHeight: 440 }}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell 
                      onClick={() => handleSort('email')}
                      sx={{ cursor: 'pointer', fontWeight: 'bold' }}
                    >
                      Email {sortBy === 'email' && (sortDir === 'asc' ? '↑' : '↓')}
                    </TableCell>
                    <TableCell 
                      onClick={() => handleSort('created_at')}
                      sx={{ cursor: 'pointer', fontWeight: 'bold' }}
                    >
                      Registered {sortBy === 'created_at' && (sortDir === 'asc' ? '↑' : '↓')}
                    </TableCell>
                    <TableCell>Subscription</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id} hover>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        {user.created_at && format(new Date(user.created_at), 'PPP')}
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={user.subscriptions?.tier || 'free'} 
                          color={getTierChipColor(user.subscriptions?.tier)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={user.subscriptions?.status || 'unknown'} 
                          color={getStatusChipColor(user.subscriptions?.status)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => handleViewUser(user.id)}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {users.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} align="center">
                        No users found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              rowsPerPageOptions={[10, 25, 50]}
              component="div"
              count={totalUsers}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
            />
          </>
        )}
      </Paper>
    </Box>
  );
}

export default Users;