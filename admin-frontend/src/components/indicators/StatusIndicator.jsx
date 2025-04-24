import React from 'react';
import { Box, Typography, LinearProgress, Chip, Tooltip } from '@mui/material';
import PropTypes from 'prop-types';

/**
 * Status indicator component with various display modes
 */
const StatusIndicator = ({ 
  type = 'badge', // badge, dot, progress, text
  status,
  label,
  value,
  size = 'medium',
  showLabel = true,
  tooltip
}) => {
  // Define status colors
  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'active':
      case 'healthy':
      case 'success':
      case 'online':
      case 'completed':
        return '#4caf50'; // success.main
      case 'warning':
      case 'pending':
      case 'processing':
      case 'waiting':
      case 'trialing':
        return '#ff9800'; // warning.main
      case 'error':
      case 'critical':
      case 'failed':
      case 'offline':
      case 'canceled':
        return '#f44336'; // error.main
      case 'inactive':
      case 'disabled':
      case 'suspended':
      case 'expired':
        return '#9e9e9e'; // grey.500
      default:
        return '#2196f3'; // primary.main
    }
  };

  const statusColor = getStatusColor(status);
  
  // Define sizes
  const getSizeProps = (size) => {
    switch (size) {
      case 'small':
        return { 
          dotSize: 8, 
          fontSize: 'caption.fontSize',
          height: 4, 
          chipSize: 'small' 
        };
      case 'large':
        return { 
          dotSize: 16, 
          fontSize: 'subtitle1.fontSize',
          height: 8, 
          chipSize: 'medium' 
        };
      case 'medium':
      default:
        return { 
          dotSize: 12, 
          fontSize: 'body2.fontSize',
          height: 6, 
          chipSize: 'small' 
        };
    }
  };
  
  const { dotSize, fontSize, height, chipSize } = getSizeProps(size);
  
  // Render based on type
  const renderIndicator = () => {
    switch (type) {
      case 'badge':
        return (
          <Chip 
            label={label || status}
            size={chipSize}
            sx={{ 
              backgroundColor: `${statusColor}20`, // 20% opacity
              color: statusColor,
              fontWeight: 'medium',
              '.MuiChip-label': {
                px: 1.5
              }
            }}
          />
        );
        
      case 'dot':
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box 
              sx={{ 
                width: dotSize, 
                height: dotSize, 
                borderRadius: '50%', 
                bgcolor: statusColor,
                boxShadow: `0 0 ${dotSize/2}px ${statusColor}40` // glow effect
              }} 
            />
            {showLabel && (
              <Typography 
                variant="body2" 
                sx={{ fontSize, color: 'text.secondary' }}
              >
                {label || status}
              </Typography>
            )}
          </Box>
        );
        
      case 'progress':
        return (
          <Box sx={{ width: '100%' }}>
            {showLabel && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="body2" sx={{ fontSize, color: 'text.secondary' }}>
                  {label || status}
                </Typography>
                {value !== undefined && (
                  <Typography variant="body2" sx={{ fontSize, fontWeight: 'medium' }}>
                    {value}%
                  </Typography>
                )}
              </Box>
            )}
            <LinearProgress
              variant="determinate"
              value={value !== undefined ? Math.max(0, Math.min(100, value)) : 100}
              sx={{
                height,
                borderRadius: height/2,
                backgroundColor: 'grey.200',
                '& .MuiLinearProgress-bar': {
                  borderRadius: height/2,
                  backgroundColor: statusColor
                }
              }}
            />
          </Box>
        );
        
      case 'text':
      default:
        return (
          <Typography 
            variant="body2" 
            sx={{ 
              fontSize, 
              color: statusColor,
              fontWeight: 'medium' 
            }}
          >
            {label || status}
          </Typography>
        );
    }
  };
  
  // Wrap in tooltip if provided
  const content = renderIndicator();
  
  if (tooltip) {
    return (
      <Tooltip title={tooltip} arrow>
        {/* Tooltips need a DOM element that can receive focus as a child */}
        <Box component="span" sx={{ display: 'inline-flex' }}>
          {content}
        </Box>
      </Tooltip>
    );
  }
  
  return content;
};

StatusIndicator.propTypes = {
  type: PropTypes.oneOf(['badge', 'dot', 'progress', 'text']),
  status: PropTypes.string.isRequired,
  label: PropTypes.string,
  value: PropTypes.number,
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  showLabel: PropTypes.bool,
  tooltip: PropTypes.string
};

export default StatusIndicator;