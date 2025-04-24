import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  CircularProgress
} from '@mui/material';
import PropTypes from 'prop-types';

/**
 * Reusable confirmation dialog component
 */
const ConfirmationDialog = ({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmColor = 'primary',
  loading = false,
  onConfirm,
  onCancel,
  confirmButtonProps = {},
  cancelButtonProps = {},
  children,
}) => {
  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onCancel}
      aria-labelledby="confirmation-dialog-title"
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle id="confirmation-dialog-title">
        {title}
      </DialogTitle>
      
      <DialogContent>
        {message && (
          <DialogContentText>{message}</DialogContentText>
        )}
        {children}
      </DialogContent>
      
      <DialogActions>
        <Button 
          onClick={onCancel} 
          disabled={loading}
          {...cancelButtonProps}
        >
          {cancelLabel}
        </Button>
        
        <Button 
          onClick={onConfirm}
          color={confirmColor}
          variant="contained"
          disabled={loading}
          startIcon={loading ? <CircularProgress size={16} /> : null}
          {...confirmButtonProps}
        >
          {loading ? 'Processing...' : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

ConfirmationDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  title: PropTypes.string.isRequired,
  message: PropTypes.string,
  confirmLabel: PropTypes.string,
  cancelLabel: PropTypes.string,
  confirmColor: PropTypes.oneOf(['primary', 'secondary', 'success', 'error', 'info', 'warning']),
  loading: PropTypes.bool,
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  confirmButtonProps: PropTypes.object,
  cancelButtonProps: PropTypes.object,
  children: PropTypes.node
};

export default ConfirmationDialog;