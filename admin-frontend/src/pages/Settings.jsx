import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Button,
  Alert,
  CircularProgress,
  Divider,
  Card,
  CardContent,
  CardHeader,
  Snackbar
} from '@mui/material';
import { Save, Refresh } from '@mui/icons-material';
import { getSettings, updateSettings } from '../services/Settings';
import { getCurrentUser } from '../services/auth';

function Settings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const settingsData = await getSettings();
      setSettings(settingsData);
      
      // Check if current user is super admin
      const user = await getCurrentUser();
      setIsSuperAdmin(user?.role === 'super_admin');
      
    } catch (err) {
      console.error('Failed to fetch settings:', err);
      setError('Failed to load system settings. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSettingChange = (section, key, value) => {
    setSettings(prevSettings => ({
      ...prevSettings,
      [section]: {
        ...prevSettings[section],
        [key]: value
      }
    }));
  };

  const handleSaveSettings = async () => {
    try {
      setSaveLoading(true);
      setSaveError(null);
      
      await updateSettings(settings);
      
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 5000);
    } catch (err) {
      console.error('Failed to save settings:', err);
      setSaveError('Failed to save settings. Please try again.');
    } finally {
      setSaveLoading(false);
    }
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
          onClick={fetchSettings}
          sx={{ mt: 2 }}
        >
          Retry
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">System Settings</Typography>
        
        <Button
          variant="contained"
          color="primary"
          startIcon={<Save />}
          onClick={handleSaveSettings}
          disabled={!isSuperAdmin || saveLoading}
        >
          {saveLoading ? 'Saving...' : 'Save Changes'}
        </Button>
      </Box>
      
      {!isSuperAdmin && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          You are viewing settings in read-only mode. Super admin privileges are required to make changes.
        </Alert>
      )}
      
      {saveError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {saveError}
        </Alert>
      )}
      
      <Snackbar
        open={saveSuccess}
        autoHideDuration={5000}
        onClose={() => setSaveSuccess(false)}
        message="Settings saved successfully"
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      />
      
      <Grid container spacing={3}>
        {/* AI Model Settings */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader title="AI Models" />
            <CardContent>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>GPT Model</InputLabel>
                    <Select
                      value={settings?.ai.gptModel || ''}
                      label="GPT Model"
                      onChange={(e) => handleSettingChange('ai', 'gptModel', e.target.value)}
                      disabled={!isSuperAdmin}
                    >
                      <MenuItem value="gpt-3.5-turbo">GPT-3.5 Turbo</MenuItem>
                      <MenuItem value="gpt-4">GPT-4</MenuItem>
                      <MenuItem value="gpt-4-turbo">GPT-4 Turbo</MenuItem>
                      <MenuItem value="claude-3-opus">Claude 3 Opus</MenuItem>
                      <MenuItem value="claude-3-sonnet">Claude 3 Sonnet</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>DALL-E Model</InputLabel>
                    <Select
                      value={settings?.ai.dalleModel || ''}
                      label="DALL-E Model"
                      onChange={(e) => handleSettingChange('ai', 'dalleModel', e.target.value)}
                      disabled={!isSuperAdmin}
                    >
                      <MenuItem value="dall-e-2">DALL-E 2</MenuItem>
                      <MenuItem value="dall-e-3">DALL-E 3</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Max Tokens"
                    type="number"
                    value={settings?.ai.maxTokens || 0}
                    onChange={(e) => handleSettingChange('ai', 'maxTokens', parseInt(e.target.value))}
                    disabled={!isSuperAdmin}
                    InputProps={{ inputProps: { min: 100, max: 8000 } }}
                  />
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Temperature"
                    type="number"
                    value={settings?.ai.temperature || 0}
                    onChange={(e) => handleSettingChange('ai', 'temperature', parseFloat(e.target.value))}
                    disabled={!isSuperAdmin}
                    InputProps={{ inputProps: { min: 0, max: 1, step: 0.1 } }}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
        
        {/* Feature Flags */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader title="Features" />
            <CardContent>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings?.features.imageGenerationEnabled || false}
                    onChange={(e) => handleSettingChange('features', 'imageGenerationEnabled', e.target.checked)}
                    disabled={!isSuperAdmin}
                  />
                }
                label="Image Generation Enabled"
                sx={{ mb: 2, display: 'block' }}
              />
              
              <FormControlLabel
                control={
                  <Switch
                    checked={settings?.features.chatEnabled || false}
                    onChange={(e) => handleSettingChange('features', 'chatEnabled', e.target.checked)}
                    disabled={!isSuperAdmin}
                  />
                }
                label="Chat Enabled"
                sx={{ mb: 2, display: 'block' }}
              />
              
              <FormControlLabel
                control={
                  <Switch
                    checked={settings?.features.subscriptionsEnabled || false}
                    onChange={(e) => handleSettingChange('features', 'subscriptionsEnabled', e.target.checked)}
                    disabled={!isSuperAdmin}
                  />
                }
                label="Subscriptions Enabled"
                sx={{ mb: 2, display: 'block' }}
              />
              
              <Divider sx={{ my: 2 }} />
              
              <FormControlLabel
                control={
                  <Switch
                    checked={settings?.monitoring.sentryEnabled || false}
                    onChange={(e) => handleSettingChange('monitoring', 'sentryEnabled', e.target.checked)}
                    disabled={!isSuperAdmin}
                  />
                }
                label="Sentry Error Monitoring Enabled"
                sx={{ mb: 2, display: 'block' }}
              />
              
              <FormControl fullWidth>
                <InputLabel>Error Reporting Level</InputLabel>
                <Select
                  value={settings?.monitoring.errorReportingLevel || 'error'}
                  label="Error Reporting Level"
                  onChange={(e) => handleSettingChange('monitoring', 'errorReportingLevel', e.target.value)}
                  disabled={!isSuperAdmin}
                >
                  <MenuItem value="debug">Debug</MenuItem>
                  <MenuItem value="info">Info</MenuItem>
                  <MenuItem value="warn">Warning</MenuItem>
                  <MenuItem value="error">Error</MenuItem>
                </Select>
              </FormControl>
            </CardContent>
          </Card>
        </Grid>
        
        {/* User Limits */}
        <Grid item xs={12}>
          <Card>
            <CardHeader title="User Limits" />
            <CardContent>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    label="Free Tier: Recipes per Month"
                    type="number"
                    value={settings?.limits.recipeGenerationsPerMonthFree || 0}
                    onChange={(e) => handleSettingChange('limits', 'recipeGenerationsPerMonthFree', parseInt(e.target.value))}
                    disabled={!isSuperAdmin}
                    InputProps={{ inputProps: { min: 0 } }}
                  />
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    label="Basic Tier: Recipes per Month"
                    type="number"
                    value={settings?.limits.recipeGenerationsPerMonthBasic || 0}
                    onChange={(e) => handleSettingChange('limits', 'recipeGenerationsPerMonthBasic', parseInt(e.target.value))}
                    disabled={!isSuperAdmin}
                    InputProps={{ inputProps: { min: 0 } }}
                  />
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    label="Free Tier: Chat Messages per Day"
                    type="number"
                    value={settings?.limits.chatMessagesPerDayFree || 0}
                    onChange={(e) => handleSettingChange('limits', 'chatMessagesPerDayFree', parseInt(e.target.value))}
                    disabled={!isSuperAdmin}
                    InputProps={{ inputProps: { min: 0 } }}
                  />
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    label="Basic Tier: Chat Messages per Day"
                    type="number"
                    value={settings?.limits.chatMessagesPerDayBasic || 0}
                    onChange={(e) => handleSettingChange('limits', 'chatMessagesPerDayBasic', parseInt(e.target.value))}
                    disabled={!isSuperAdmin}
                    InputProps={{ inputProps: { min: 0 } }}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

export default Settings;