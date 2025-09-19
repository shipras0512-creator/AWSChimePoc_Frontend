import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import HostPage from "./HostPage";
import JoinMeeting from "./JoinMeeting";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HostPage />} />
        <Route path="/join" element={<JoinMeeting />} />
      </Routes>
    </Router>
  );
}

export default App;
