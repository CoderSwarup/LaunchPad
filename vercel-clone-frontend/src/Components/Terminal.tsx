import { Box } from "@mui/material";
import React from "react";
import Terminal, { ColorMode } from "react-terminal-ui";

const TerminalUI = ({
  terminalLineData,
}: {
  terminalLineData: React.ReactElement[];
}) => {
  // Terminal has 100% width by default so it should usually be wrapped in a container div
  return (
    <Box
      sx={{
        padding: "10px",
      }}
    >
      <Terminal
        height="400px"
        name="Project Depoyment Logs"
        colorMode={ColorMode.Dark}
        // onInput={(terminalInput) =>
        //   console.log(`New terminal input received: '${terminalInput}'`)
        // }
      >
        {terminalLineData}
      </Terminal>
    </Box>
  );
};

export default TerminalUI;
