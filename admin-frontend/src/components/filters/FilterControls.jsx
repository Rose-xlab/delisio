import React, { useState } from 'react';
import {
  Box,
  Paper,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  InputAdornment,
  IconButton,
  Collapse,
  Divider,
  Typography,
  Chip
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterListIcon,
  Clear as ClearIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import PropTypes from 'prop-types';

/**
 * Reusable filter controls component for search, filtering, and sorting
 */
const FilterControls = ({
  filters,
  onFilterChange,
  onSearch,
  onReset,
  searchPlaceholder = 'Search...',
  loading = false,
  filterOptions = [],
  sortOptions = [],
  activeFiltersCount = 0,
  collapsible = false,
  showSort = true
}) => {
  const [expanded, setExpanded] = useState(!collapsible);
  const [searchTerm, setSearchTerm] = useState(filters.search || '');

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleSearch = () => {
    onFilterChange({ ...filters, search: searchTerm, page: 0 });
    if (onSearch) onSearch(searchTerm);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleFilterChange = (name, value) => {
    onFilterChange({ ...filters, [name]: value, page: 0 });
  };

  const handleSortChange = (e) => {
    const value = e.target.value;
    const [sortBy, sortDir] = value.split(':');
    onFilterChange({ ...filters, sortBy, sortDir, page: 0 });
  };

  const handleReset = () => {
    setSearchTerm('');
    if (onReset) {
      onReset();
    } else {
      // Default reset behavior
      const resetFilters = {
        search: '',
        page: 0
      };
      
      // Add default values for filter options
      filterOptions.forEach(filter => {
        resetFilters[filter.name] = filter.defaultValue || '';
      });
      
      // Add default sort values if sort options exist
      if (sortOptions.length > 0) {
        const defaultSort = sortOptions[0].value.split(':');
        resetFilters.sortBy = defaultSort[0];
        resetFilters.sortDir = defaultSort[1];
      }
      
      onFilterChange(resetFilters);
    }
  };

  const handleToggleExpand = () => {
    setExpanded(!expanded);
  };

  const getSortValue = () => {
    if (filters.sortBy && filters.sortDir) {
      return `${filters.sortBy}:${filters.sortDir}`;
    }
    return sortOptions.length > 0 ? sortOptions[0].value : '';
  };

  return (
    <Paper sx={{ p: 2, mb: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: collapsible ? 1 : 2 }}>
        {collapsible ? (
          <Button
            variant="text"
            color="inherit"
            onClick={handleToggleExpand}
            startIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            sx={{ fontWeight: 'normal' }}
          >
            Filters
            {activeFiltersCount > 0 && (
              <Chip
                label={activeFiltersCount}
                color="primary"
                size="small"
                sx={{ ml: 1, height: 20, minWidth: 20 }}
              />
            )}
          </Button>
        ) : (
          <Typography variant="subtitle1">
            Filters
            {activeFiltersCount > 0 && (
              <Chip
                label={activeFiltersCount}
                color="primary"
                size="small"
                sx={{ ml: 1, height: 20, minWidth: 20 }}
              />
            )}
          </Typography>
        )}
        
        <Button
          variant="text"
          startIcon={<RefreshIcon />}
          onClick={handleReset}
          disabled={loading}
        >
          Reset
        </Button>
      </Box>
      
      <Collapse in={expanded}>
        <Divider sx={{ mb: 2 }} />
        
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={4}>
            <TextField
              fullWidth
              label="Search"
              variant="outlined"
              value={searchTerm}
              onChange={handleSearchChange}
              onKeyPress={handleKeyPress}
              placeholder={searchPlaceholder}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    {searchTerm && (
                      <IconButton
                        edge="end"
                        onClick={() => {
                          setSearchTerm('');
                          if (filters.search) {
                            handleFilterChange('search', '');
                          }
                        }}
                        size="small"
                      >
                        <ClearIcon />
                      </IconButton>
                    )}
                    <IconButton 
                      edge="end" 
                      onClick={handleSearch}
                      disabled={loading}
                    >
                      <SearchIcon />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              disabled={loading}
            />
          </Grid>
          
          {/* Filter Options */}
          {filterOptions.map((filter) => (
            <Grid item xs={12} sm={6} md={filter.width || 3} key={filter.name}>
              <FormControl fullWidth>
                <InputLabel>{filter.label}</InputLabel>
                <Select
                  value={filters[filter.name] || filter.defaultValue || ''}
                  label={filter.label}
                  onChange={(e) => handleFilterChange(filter.name, e.target.value)}
                  disabled={loading}
                >
                  {filter.allowEmpty && (
                    <MenuItem value="">All</MenuItem>
                  )}
                  {filter.options.map((option) => (
                    <MenuItem 
                      key={option.value} 
                      value={option.value}
                    >
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          ))}
          
          {/* Sort Options */}
          {showSort && sortOptions.length > 0 && (
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Sort By</InputLabel>
                <Select
                  value={getSortValue()}
                  label="Sort By"
                  onChange={handleSortChange}
                  disabled={loading}
                >
                  {sortOptions.map((option) => (
                    <MenuItem 
                      key={option.value} 
                      value={option.value}
                    >
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          )}
          
          {/* Search Button (for xs screens) */}
          <Grid item xs={12} display={{ sm: 'none' }}>
            <Button
              fullWidth
              variant="contained"
              onClick={handleSearch}
              startIcon={<SearchIcon />}
              disabled={loading}
            >
              Search
            </Button>
          </Grid>
        </Grid>
      </Collapse>
    </Paper>
  );
};

FilterControls.propTypes = {
  filters: PropTypes.object.isRequired,
  onFilterChange: PropTypes.func.isRequired,
  onSearch: PropTypes.func,
  onReset: PropTypes.func,
  searchPlaceholder: PropTypes.string,
  loading: PropTypes.bool,
  filterOptions: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      options: PropTypes.arrayOf(
        PropTypes.shape({
          value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
          label: PropTypes.string.isRequired
        })
      ).isRequired,
      defaultValue: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      allowEmpty: PropTypes.bool,
      width: PropTypes.number
    })
  ),
  sortOptions: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired
    })
  ),
  activeFiltersCount: PropTypes.number,
  collapsible: PropTypes.bool,
  showSort: PropTypes.bool
};

export default FilterControls;