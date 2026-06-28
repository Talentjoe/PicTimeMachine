import { createTheme } from '@mui/material/styles';

/** Shared MUI theme — unified palette, typography and shape across the app. */
const theme = createTheme({
  palette: {
    primary: { main: '#2e7d6b' },
    secondary: { main: '#e0533d' },
    background: { default: '#f5f6f8' },
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily:
      '"PingFang SC", "Microsoft YaHei", system-ui, "Helvetica Neue", Arial, sans-serif',
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
  },
  components: {
    MuiButton: { defaultProps: { disableElevation: true } },
  },
});

export default theme;
