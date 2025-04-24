import React from 'react';
import { Box, Paper, Typography, CircularProgress } from '@mui/material';
import PropTypes from 'prop-types';

/**
 * Reusable component for displaying simple statistics with an icon
 */
const StatsCard = ({ 
  title, 
  value, 
  icon, 
  color = 'primary.main', 
  loading = false, 
  subtitle,
  trend,
  trendValue,
  trendIcon,
  trendColor 
}) => {
  return (
    <Paper elevation={2} sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography color="text.secondary" variant="body2">{title}</Typography>
        {icon && <Box sx={{ color }}>{icon}</Box>}
      </Box>
      
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress size={24} />
        </Box>
      ) : (
        <>
          <Typography component="div" variant="h4" sx={{ mb: 1 }}>
            {value}
          </Typography>
          
          {subtitle && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {subtitle}
            </Typography>
          )}
          
          {trend && (
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              mt: 'auto',
              color: trendColor || 'text.secondary'
            }}>
              {trendIcon}
              <Typography variant="body2" sx={{ ml: 0.5 }}>
                {trendValue} {trend}
              </Typography>
            </Box>
          )}
        </>
      )}
    </Paper>
  );
};

StatsCard.propTypes = {
  title: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number,
    PropTypes.node
  ]).isRequired,
  icon: PropTypes.node,
  color: PropTypes.string,
  loading: PropTypes.bool,
  subtitle: PropTypes.string,
  trend: PropTypes.string,
  trendValue: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number
  ]),
  trendIcon: PropTypes.node,
  trendColor: PropTypes.string
};

export default StatsCard;