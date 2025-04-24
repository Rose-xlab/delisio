import React, { Component } from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import { ErrorOutline, Refresh } from '@mui/icons-material';
import PropTypes from 'prop-types';

/**
 * Error boundary component to catch and display errors
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error to an error reporting service
    this.setState({ errorInfo });
    
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
    
    // You could also log the error to a reporting service
    console.error('Error caught by ErrorBoundary:', error, errorInfo);
  }
  
  handleReset = () => {
    this.setState({ 
      hasError: false,
      error: null,
      errorInfo: null
    });
    
    if (this.props.onReset) {
      this.props.onReset();
    }
  }

  render() {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallback, showReset = true } = this.props;
    
    if (hasError) {
      // Custom fallback UI
      if (fallback) {
        return typeof fallback === 'function' 
          ? fallback(error, errorInfo, this.handleReset)
          : fallback;
      }
      
      // Default error UI
      return (
        <Paper
          elevation={3}
          sx={{
            p: 4,
            borderRadius: 2,
            textAlign: 'center',
            maxWidth: 600,
            mx: 'auto',
            my: 4
          }}
        >
          <ErrorOutline color="error" sx={{ fontSize: 60, mb: 2 }} />
          
          <Typography variant="h5" gutterBottom>
            Something went wrong
          </Typography>
          
          <Typography variant="body1" color="text.secondary" paragraph>
            {error?.message || 'An unexpected error occurred'}
          </Typography>
          
          {process.env.NODE_ENV !== 'production' && errorInfo && (
            <Box sx={{ mt: 2, mb: 3, textAlign: 'left' }}>
              <Typography variant="subtitle2" gutterBottom>
                Error details:
              </Typography>
              <Box
                component="pre"
                sx={{
                  p: 2,
                  borderRadius: 1,
                  bgcolor: 'grey.100',
                  color: 'grey.800',
                  overflowX: 'auto',
                  fontSize: '0.75rem',
                  maxHeight: 200
                }}
              >
                {errorInfo.componentStack}
              </Box>
            </Box>
          )}
          
          {showReset && (
            <Button
              variant="contained"
              color="primary"
              startIcon={<Refresh />}
              onClick={this.handleReset}
              sx={{ mt: 2 }}
            >
              Try Again
            </Button>
          )}
        </Paper>
      );
    }

    return children;
  }
}

ErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired,
  fallback: PropTypes.oneOfType([
    PropTypes.node,
    PropTypes.func
  ]),
  onError: PropTypes.func,
  onReset: PropTypes.func,
  showReset: PropTypes.bool
};

export default ErrorBoundary;