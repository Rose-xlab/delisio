import React from 'react';
import { Box, Typography, Button, Divider } from '@mui/material';
import PropTypes from 'prop-types';

/**
 * Reusable page header component with title and optional actions
 */
const PageHeader = ({ 
  title, 
  subtitle, 
  actions, 
  backButton,
  divider = true 
}) => {
  return (
    <Box sx={{ mb: divider ? 3 : 2 }}>
      <Box sx={{ 
        display: 'flex', 
        alignItems: { xs: 'flex-start', sm: 'center' }, 
        justifyContent: 'space-between',
        flexDirection: { xs: 'column', sm: 'row' },
        gap: { xs: 2, sm: 0 }
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          {backButton && (
            <Box sx={{ mr: 2 }}>{backButton}</Box>
          )}
          <Box>
            <Typography variant="h4" component="h1">
              {title}
            </Typography>
            {subtitle && (
              <Typography variant="subtitle1" color="text.secondary" sx={{ mt: 0.5 }}>
                {subtitle}
              </Typography>
            )}
          </Box>
        </Box>
        
        {actions && (
          <Box sx={{ 
            display: 'flex', 
            gap: 1,
            width: { xs: '100%', sm: 'auto' }
          }}>
            {Array.isArray(actions) ? actions.map((action, index) => (
              <React.Fragment key={index}>
                {action}
              </React.Fragment>
            )) : actions}
          </Box>
        )}
      </Box>
      
      {divider && <Divider sx={{ mt: 2 }} />}
    </Box>
  );
};

PageHeader.propTypes = {
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
  actions: PropTypes.oneOfType([
    PropTypes.node,
    PropTypes.arrayOf(PropTypes.node)
  ]),
  backButton: PropTypes.node,
  divider: PropTypes.bool
};

export default PageHeader;