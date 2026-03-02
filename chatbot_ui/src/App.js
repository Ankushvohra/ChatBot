import React from 'react';
import ChatBot from './components/ChatBot/ChatBot';
import AgentDashboard from './components/AgentDashboard/AgentDashboard';
import './App.css';

function App() {
  return (
    <div className="App">
      <AgentDashboard />
      <ChatBot />
    </div>
  );
}

export default App;
