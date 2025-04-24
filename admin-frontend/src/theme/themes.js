// Theme configuration for light and dark modes

// Common theme settings
const commonSettings = {
    typography: {
      fontFamily: [
        '-apple-system',
        'BlinkMacSystemFont',
        '"Segoe UI"',
        'Roboto',
        '"Helvetica Neue"',
        'Arial',
        'sans-serif',
        '"Apple Color Emoji"',
        '"Segoe UI Emoji"',
        '"Segoe UI Symbol"',
      ].join(','),
      h1: {
        fontWeight: 600,
        fontSize: '2.25rem',
      },
      h2: {
        fontWeight: 600,
        fontSize: '1.875rem',
      },
      h3: {
        fontWeight: 600,
        fontSize: '1.5rem',
      },
      h4: {
        fontWeight: 600,
        fontSize: '1.25rem',
      },
      h5: {
        fontWeight: 600,
        fontSize: '1.125rem',
      },
      h6: {
        fontWeight: 600,
        fontSize: '1rem',
      },
      subtitle1: {
        fontSize: '1rem',
        fontWeight: 500,
      },
      subtitle2: {
        fontSize: '0.875rem',
        fontWeight: 500,
      },
      body1: {
        fontSize: '1rem',
      },
      body2: {
        fontSize: '0.875rem',
      },
      button: {
        textTransform: 'none',
        fontWeight: 600,
      },
    },
    shape: {
      borderRadius: 8,
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            fontWeight: 600,
            boxShadow: 'none',
            textTransform: 'none',
            ':hover': {
              boxShadow: 'none',
            }
          },
          sizeSmall: {
            padding: '6px 16px',
          },
          sizeMedium: {
            padding: '8px 20px',
          },
          sizeLarge: {
            padding: '10px 24px',
          },
          textSizeSmall: {
            padding: '7px 12px',
          },
          textSizeMedium: {
            padding: '9px 16px',
          },
          textSizeLarge: {
            padding: '12px 16px',
          },
        },
      },
      MuiCardContent: {
        styleOverrides: {
          root: {
            padding: '24px',
            '&:last-child': {
              paddingBottom: '24px',
            },
          },
        },
      },
      MuiCardHeader: {
        defaultProps: {
          titleTypographyProps: {
            variant: 'h6',
          },
          subheaderTypographyProps: {
            variant: 'body2',
            marginTop: '4px',
          },
        },
        styleOverrides: {
          root: {
            padding: '24px',
          },
        },
      },
      MuiCssBaseline: {
        styleOverrides: {
          '*': {
            boxSizing: 'border-box',
          },
          html: {
            MozOsxFontSmoothing: 'grayscale',
            WebkitFontSmoothing: 'antialiased',
            display: 'flex',
            flexDirection: 'column',
            minHeight: '100%',
            width: '100%',
          },
          body: {
            display: 'flex',
            flex: '1 1 auto',
            flexDirection: 'column',
            minHeight: '100%',
            width: '100%',
          },
          '#root': {
            display: 'flex',
            flex: '1 1 auto',
            flexDirection: 'column',
            height: '100%',
            width: '100%',
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          notchedOutline: {
            borderColor: '#E6E8F0',
          },
        },
      },
      MuiTableHead: {
        styleOverrides: {
          root: {
            backgroundColor: '#F3F4F6',
            '.MuiTableCell-root': {
              color: '#374151',
            },
            borderBottom: 'none',
            '& .MuiTableCell-root': {
              borderBottom: 'none',
              fontSize: '0.75rem',
              fontWeight: 600,
              lineHeight: 1,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
            },
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            borderBottom: '1px solid #F3F4F6',
            padding: '16px',
          },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            '&:last-of-type td': {
              borderBottom: 0,
            },
          },
        }
      },
      MuiAlert: {
        styleOverrides: {
          root: {
            borderRadius: 8,
          },
        },
      },
    },
  };
  
  // Light theme
  export const lightTheme = {
    ...commonSettings,
    palette: {
      mode: 'light',
      background: {
        default: '#F9FAFC',
        paper: '#FFFFFF',
      },
      primary: {
        main: '#2563EB',  // Blue
        light: '#DBEAFE',
        dark: '#1E40AF',
        contrastText: '#FFFFFF',
      },
      secondary: {
        main: '#10B981',  // Green
        light: '#D1FAE5',
        dark: '#059669',
        contrastText: '#FFFFFF',
      },
      success: {
        main: '#10B981',  // Green
        light: '#D1FAE5',
        dark: '#059669',
      },
      info: {
        main: '#0ea5e9',  // Light blue
        light: '#e0f2fe',
        dark: '#0369a1',
      },
      warning: {
        main: '#f59e0b',  // Amber
        light: '#fef3c7',
        dark: '#b45309',
      },
      error: {
        main: '#ef4444',  // Red
        light: '#fee2e2',
        dark: '#b91c1c',
      },
      text: {
        primary: '#111827',
        secondary: '#6B7280',
        disabled: '#9CA3AF',
      },
      divider: '#E6E8F0',
      action: {
        active: '#6B7280',
        hover: 'rgba(55, 65, 81, 0.04)',
        selected: 'rgba(55, 65, 81, 0.08)',
        disabled: 'rgba(55, 65, 81, 0.26)',
        disabledBackground: 'rgba(55, 65, 81, 0.12)',
        focus: 'rgba(55, 65, 81, 0.12)',
      },
    },
    shadows: [
      'none',
      '0px 1px 2px rgba(0, 0, 0, 0.06), 0px 1px 3px rgba(0, 0, 0, 0.1)',
      '0px 1px 2px rgba(0, 0, 0, 0.06), 0px 2px 4px rgba(0, 0, 0, 0.1)',
      '0px 1px 3px rgba(0, 0, 0, 0.06), 0px 4px 6px rgba(0, 0, 0, 0.1)',
      '0px 2px 4px rgba(0, 0, 0, 0.06), 0px 6px 8px rgba(0, 0, 0, 0.1)',
      '0px 3px 6px rgba(0, 0, 0, 0.06), 0px 8px 12px rgba(0, 0, 0, 0.1)',
      '0px 4px 8px rgba(0, 0, 0, 0.06), 0px 10px 16px rgba(0, 0, 0, 0.1)',
      '0px 5px 10px rgba(0, 0, 0, 0.06), 0px 12px 20px rgba(0, 0, 0, 0.1)',
      '0px 6px 12px rgba(0, 0, 0, 0.06), 0px 14px 24px rgba(0, 0, 0, 0.1)',
      '0px 7px 14px rgba(0, 0, 0, 0.06), 0px 16px 28px rgba(0, 0, 0, 0.1)',
      '0px 8px 16px rgba(0, 0, 0, 0.06), 0px 18px 32px rgba(0, 0, 0, 0.1)',
      '0px 9px 18px rgba(0, 0, 0, 0.06), 0px 20px 36px rgba(0, 0, 0, 0.1)',
      '0px 10px 20px rgba(0, 0, 0, 0.06), 0px 22px 40px rgba(0, 0, 0, 0.1)',
      '0px 11px 22px rgba(0, 0, 0, 0.06), 0px 24px 44px rgba(0, 0, 0, 0.1)',
      '0px 12px 24px rgba(0, 0, 0, 0.06), 0px 26px 48px rgba(0, 0, 0, 0.1)',
      '0px 13px 26px rgba(0, 0, 0, 0.06), 0px 28px 52px rgba(0, 0, 0, 0.1)',
      '0px 14px 28px rgba(0, 0, 0, 0.06), 0px 30px 56px rgba(0, 0, 0, 0.1)',
      '0px 15px 30px rgba(0, 0, 0, 0.06), 0px 32px 60px rgba(0, 0, 0, 0.1)',
      '0px 16px 32px rgba(0, 0, 0, 0.06), 0px 34px 64px rgba(0, 0, 0, 0.1)',
      '0px 17px 34px rgba(0, 0, 0, 0.06), 0px 36px 68px rgba(0, 0, 0, 0.1)',
      '0px 18px 36px rgba(0, 0, 0, 0.06), 0px 38px 72px rgba(0, 0, 0, 0.1)',
      '0px 19px 38px rgba(0, 0, 0, 0.06), 0px 40px 76px rgba(0, 0, 0, 0.1)',
      '0px 20px 40px rgba(0, 0, 0, 0.06), 0px 42px 80px rgba(0, 0, 0, 0.1)',
      '0px 21px 42px rgba(0, 0, 0, 0.06), 0px 44px 84px rgba(0, 0, 0, 0.1)',
    ],
  };
  
  // Dark theme
  export const darkTheme = {
    ...commonSettings,
    palette: {
      mode: 'dark',
      background: {
        default: '#171717',
        paper: '#262626',
      },
      primary: {
        main: '#3b82f6',  // Blue
        light: '#93c5fd',
        dark: '#1d4ed8',
        contrastText: '#FFFFFF',
      },
      secondary: {
        main: '#10b981',  // Green
        light: '#6ee7b7',
        dark: '#059669',
        contrastText: '#FFFFFF',
      },
      success: {
        main: '#10b981',  // Green
        light: '#6ee7b7',
        dark: '#059669',
        contrastText: '#FFFFFF',
      },
      info: {
        main: '#0ea5e9',  // Light blue
        light: '#7dd3fc',
        dark: '#0369a1',
        contrastText: '#FFFFFF',
      },
      warning: {
        main: '#f59e0b',  // Amber
        light: '#fcd34d',
        dark: '#b45309',
        contrastText: '#FFFFFF',
      },
      error: {
        main: '#ef4444',  // Red
        light: '#fca5a5',
        dark: '#b91c1c',
        contrastText: '#FFFFFF',
      },
      text: {
        primary: '#f9fafb',
        secondary: '#9ca3af',
        disabled: '#6b7280',
      },
      divider: 'rgba(255, 255, 255, 0.12)',
      action: {
        active: '#e5e7eb',
        hover: 'rgba(255, 255, 255, 0.08)',
        selected: 'rgba(255, 255, 255, 0.16)',
        disabled: 'rgba(255, 255, 255, 0.3)',
        disabledBackground: 'rgba(255, 255, 255, 0.12)',
        focus: 'rgba(255, 255, 255, 0.12)',
      },
    },
    shadows: [
      'none',
      '0px 1px 2px rgba(0, 0, 0, 0.25), 0px 1px 3px rgba(0, 0, 0, 0.3)',
      '0px 1px 2px rgba(0, 0, 0, 0.25), 0px 2px 4px rgba(0, 0, 0, 0.3)',
      '0px 1px 3px rgba(0, 0, 0, 0.25), 0px 4px 6px rgba(0, 0, 0, 0.3)',
      '0px 2px 4px rgba(0, 0, 0, 0.25), 0px 6px 8px rgba(0, 0, 0, 0.3)',
      '0px 3px 6px rgba(0, 0, 0, 0.25), 0px 8px 12px rgba(0, 0, 0, 0.3)',
      '0px 4px 8px rgba(0, 0, 0, 0.25), 0px 10px 16px rgba(0, 0, 0, 0.3)',
      '0px 5px 10px rgba(0, 0, 0, 0.25), 0px 12px 20px rgba(0, 0, 0, 0.3)',
      '0px 6px 12px rgba(0, 0, 0, 0.25), 0px 14px 24px rgba(0, 0, 0, 0.3)',
      '0px 7px 14px rgba(0, 0, 0, 0.25), 0px 16px 28px rgba(0, 0, 0, 0.3)',
      '0px 8px 16px rgba(0, 0, 0, 0.25), 0px 18px 32px rgba(0, 0, 0, 0.3)',
      '0px 9px 18px rgba(0, 0, 0, 0.25), 0px 20px 36px rgba(0, 0, 0, 0.3)',
      '0px 10px 20px rgba(0, 0, 0, 0.25), 0px 22px 40px rgba(0, 0, 0, 0.3)',
      '0px 11px 22px rgba(0, 0, 0, 0.25), 0px 24px 44px rgba(0, 0, 0, 0.3)',
      '0px 12px 24px rgba(0, 0, 0, 0.25), 0px 26px 48px rgba(0, 0, 0, 0.3)',
      '0px 13px 26px rgba(0, 0, 0, 0.25), 0px 28px 52px rgba(0, 0, 0, 0.3)',
      '0px 14px 28px rgba(0, 0, 0, 0.25), 0px 30px 56px rgba(0, 0, 0, 0.3)',
      '0px 15px 30px rgba(0, 0, 0, 0.25), 0px 32px 60px rgba(0, 0, 0, 0.3)',
      '0px 16px 32px rgba(0, 0, 0, 0.25), 0px 34px 64px rgba(0, 0, 0, 0.3)',
      '0px 17px 34px rgba(0, 0, 0, 0.25), 0px 36px 68px rgba(0, 0, 0, 0.3)',
      '0px 18px 36px rgba(0, 0, 0, 0.25), 0px 38px 72px rgba(0, 0, 0, 0.3)',
      '0px 19px 38px rgba(0, 0, 0, 0.25), 0px 40px 76px rgba(0, 0, 0, 0.3)',
      '0px 20px 40px rgba(0, 0, 0, 0.25), 0px 42px 80px rgba(0, 0, 0, 0.3)',
      '0px 21px 42px rgba(0, 0, 0, 0.25), 0px 44px 84px rgba(0, 0, 0, 0.3)',
    ],
    components: {
      ...commonSettings.components,
      MuiTableHead: {
        styleOverrides: {
          root: {
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            '.MuiTableCell-root': {
              color: '#f3f4f6',
            },
            borderBottom: 'none',
            '& .MuiTableCell-root': {
              borderBottom: 'none',
              fontSize: '0.75rem',
              fontWeight: 600,
              lineHeight: 1,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
            },
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          notchedOutline: {
            borderColor: 'rgba(255, 255, 255, 0.23)',
          },
        },
      },
    },
  };