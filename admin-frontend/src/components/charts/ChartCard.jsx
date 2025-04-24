import React from 'react';
import { 
  Box, 
  Paper, 
  Typography, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  CircularProgress 
} from '@mui/material';
import PropTypes from 'prop-types';

/**
 * Reusable chart card component with title, period selection, and loading state
 */
const ChartCard = ({ 
  title, 
  children, 
  height = 300, 
  loading = false, 
  period, 
  onPeriodChange,
  periodOptions = [
    { value: '7d', label: '7 days' },
    { value: '30d', label: '30 days' },
    { value: '90d', label: '90 days' }
  ],
  noDataMessage = 'No data available'
}) => {
  return (
    <Paper sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">{title}</Typography>
        
        {onPeriodChange && period && (
          <FormControl size="small" sx={{ width: 120 }}>
            <InputLabel id={`${title.replace(/\s+/g, '-').toLowerCase()}-period-label`}>Period</InputLabel>
            <Select
              labelId={`${title.replace(/\s+/g, '-').toLowerCase()}-period-label`}
              value={period}
              label="Period"
              onChange={(e) => onPeriodChange(e.target.value)}
            >
              {periodOptions.map(option => (
                <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </Box>
      
      <Box sx={{ height, position: 'relative' }}>
        {loading ? (
          <Box sx={{ 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center' 
          }}>
            <CircularProgress size={40} />
          </Box>
        ) : children ? (
          children
        ) : (
          <Box sx={{ 
            height: '100%', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center' 
          }}>
            <Typography color="text.secondary">{noDataMessage}</Typography>
          </Box>
        )}
      </Box>
    </Paper>
  );
};

ChartCard.propTypes = {
  title: PropTypes.string.isRequired,
  children: PropTypes.node,
  height: PropTypes.number,
  loading: PropTypes.bool,
  period: PropTypes.string,
  onPeriodChange: PropTypes.func,
  periodOptions: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired
    })
  ),
  noDataMessage: PropTypes.string
};

export default ChartCard;