import { createTheme } from "@mui/material";

const defaultTheme = createTheme({
  palette: {
    background: {
      default: "#000000",
    },
    text: {
      primary: "#ffffff", // This sets the default text color
      secondary: "#a1a1a1",
    },
  },
  typography: {
    fontFamily: "'Comic Sans MS', 'Cursive', sans-serif", // Set default font to cursive
  },
});

export default defaultTheme;
