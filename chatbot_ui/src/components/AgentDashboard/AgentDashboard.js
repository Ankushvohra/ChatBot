import React from 'react';
import './AgentDashboard.css';

const AgentDashboard = () => {
  const openAgentDashboard = () => {
    const dashboardWindow = window.open(
      '',
      'AgentDashboard',
      'width=1200,height=700,resizable=yes,scrollbars=yes,status=yes,menubar=no,toolbar=no'
    );

    if (dashboardWindow) {
      dashboardWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Agent Dashboard</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
              background: #f8f9fa;
              height: 100vh;
              overflow: hidden;
            }
            .dashboard-layout {
              display: grid;
              grid-template-columns: 280px 1fr 280px;
              grid-template-rows: 50px 1fr;
              height: 100vh;
              gap: 8px;
              padding: 8px;
              background: #f8f9fa;
            }
            .dashboard-header {
              grid-column: 1 / -1;
              background: #9333ea;
              color: white;
              padding: 8px 15px;
              border-radius: 6px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              box-shadow: 0 2px 4px rgba(0, 0, 0, .1);
            }
            .header-title {
              font-size: 16px;
              font-weight: 600;
              text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
            }
            .agent-status-dropdown {
              position: relative;
            }
            .status-select {
              background: white;
              border: 2px solid #9333ea;
              color: #9333ea;
              padding: 6px 12px;
              border-radius: 6px;
              font-size: 12px;
              font-weight: 600;
              cursor: pointer;
              outline: none;
              min-width: 110px;
              box-shadow: 0 1px 3px rgba(147, 51, 234, 0.1);
              transition: all 0.2s ease;
            }
            .status-select:hover {
              background: #9333ea;
              color: white;
            }
            .status-select option {
              background: white;
              color: #9333ea;
              padding: 10px;
            }
            .left-panel, .middle-panel, .right-panel {
              background: white;
              border-radius: 6px;
              padding: 12px;
              box-shadow: 0 2px 4px rgba(0, 0, 0, .1);
              display: flex;
              flex-direction: column;
            }
            .panel-title {
              color: #9333ea;
              font-size: 14px;
              font-weight: 600;
              margin-bottom: 10px;
              padding-bottom: 6px;
              border-bottom: 1px solid #e2e8f0;
            }
            .chat-container {
              flex: 1;
              display: flex;
              flex-direction: column;
              border: 1px solid #e2e8f0;
              border-radius: 6px;
              overflow: hidden;
              max-height: 350px;
            }
            .chat-messages {
              flex: 1;
              padding: 8px;
              overflow-y: auto;
              background: #f8f9fa;
              max-height: 300px;
              font-size: 13px;
            }
            .message {
              margin-bottom: 6px;
              padding: 6px 10px;
              border-radius: 10px;
              max-width: 85%;
              word-wrap: break-word;
              font-size: 12px;
            }
            .message.user {
              background: #9333ea;
              color: white;
              align-self: flex-end;
              margin-left: auto;
            }
            .message.bot {
              background: white;
              color: #2d3748;
              border: 1px solid #e2e8f0;
            }
            .chat-input {
              display: flex;
              padding: 6px;
              background: white;
              border-top: 1px solid #e2e8f0;
              gap: 6px;
            }
            .chat-input input {
              flex: 1;
              padding: 6px 10px;
              border: 1px solid #e2e8f0;
              border-radius: 6px;
              outline: none;
              font-size: 12px;
            }
            .chat-input button {
              background: #9333ea;
              color: white;
              border: 2px solid #9333ea;
              padding: 6px 12px;
              border-radius: 6px;
              cursor: pointer;
              font-weight: 600;
              font-size: 12px;
              transition: all 0.2s ease;
              box-shadow: 0 1px 3px rgba(147, 51, 234, 0.2);
            }
            .chat-input button:hover {
              background: #7c3aed;
              border-color: #7c3aed;
              transform: translateY(-1px);
              box-shadow: 0 4px 8px rgba(147, 51, 234, 0.3);
            }
            .customer-queue {
              flex: 1;
              overflow-y: auto;
              max-height: 400px;
              padding-right: 4px;
            }
            .customer-queue::-webkit-scrollbar {
              width: 6px;
            }
            .customer-queue::-webkit-scrollbar-track {
              background: #f1f1f1;
              border-radius: 3px;
            }
            .customer-queue::-webkit-scrollbar-thumb {
              background: #9333ea;
              border-radius: 3px;
            }
            .customer-queue::-webkit-scrollbar-thumb:hover {
              background: #7c3aed;
            }
            .queue-item {
              background: #f8f9fa;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              padding: 15px;
              margin-bottom: 10px;
              cursor: pointer;
              transition: all 0.2s ease;
            }
            .queue-item:hover {
              background: rgba(147, 51, 234, 0.05);
              border-color: #9333ea;
              transform: translateY(-1px);
              box-shadow: 0 4px 8px rgba(147, 51, 234, 0.1);
            }
            .queue-item.active {
              background: rgba(147, 51, 234, 0.1);
              border-color: #9333ea;
            }
            .customer-info {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 8px;
            }
            .customer-name {
              font-weight: 600;
              color: #9333ea;
            }
            .wait-time {
              font-size: 12px;
              color: #666;
              background: #e2e8f0;
              padding: 2px 6px;
              border-radius: 4px;
            }
            .customer-query {
              font-size: 13px;
              color: #666;
              margin-bottom: 8px;
            }
            .queue-status {
              font-size: 12px;
              font-weight: 600;
              padding: 6px 12px;
              border-radius: 6px;
              background: white;
              color: #9333ea;
              border: 1px solid #9333ea;
              box-shadow: 0 1px 3px rgba(147, 51, 234, 0.1);
            }
            .queue-status.in-progress {
              background: #9333ea;
              color: white;
              box-shadow: 0 2px 4px rgba(147, 51, 234, 0.3);
            }
            .ai-agent-panel {
              flex: 1;
            }
            .ai-suggestions {
              background: #f8f9fa;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              padding: 15px;
              margin-bottom: 15px;
            }
            .suggestion-item {
              background: white;
              border: 1px solid #e2e8f0;
              border-radius: 6px;
              padding: 10px;
              margin-bottom: 8px;
              cursor: pointer;
              transition: all 0.2s ease;
            }
            .suggestion-item:hover {
              background: rgba(147, 51, 234, 0.05);
              border-color: #9333ea;
            }
            .suggestion-title {
              font-weight: 600;
              color: #9333ea;
              font-size: 13px;
              margin-bottom: 4px;
            }
            .suggestion-text {
              font-size: 12px;
              color: #666;
            }
            .stats-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 6px;
              margin-bottom: 8px;
            }
            .stat-card {
              background: #f8f9fa;
              padding: 8px;
              border-radius: 4px;
              text-align: center;
              border-left: 2px solid #9333ea;
            }
            .stat-number {
              font-size: 14px;
              font-weight: 700;
              color: #9333ea;
            }
            .stat-label {
              font-size: 10px;
              color: #666;
              margin-top: 2px;
            }
            .action-buttons {
              display: flex;
              gap: 8px;
              margin-top: 10px;
            }
            .action-btn {
              flex: 1;
              padding: 6px 8px;
              border: 1px solid #9333ea;
              background: white;
              color: #9333ea;
              border-radius: 4px;
              cursor: pointer;
              font-size: 11px;
              font-weight: 600;
              transition: all 0.2s ease;
              box-shadow: 0 1px 2px rgba(147, 51, 234, 0.1);
            }
            .action-btn:hover {
              background: #9333ea;
              color: white;
              transform: translateY(-1px);
              box-shadow: 0 4px 8px rgba(147, 51, 234, 0.2);
            }
            .connection-status {
              display: flex;
              align-items: center;
              gap: 8px;
              margin-bottom: 15px;
            }
            .status-dot {
              width: 10px;
              height: 10px;
              border-radius: 50%;
              background: #9333ea;
              box-shadow: 0 0 0 3px rgba(147, 51, 234, 0.2);
              animation: pulse-dot 2s infinite;
            }
            @keyframes pulse-dot {
              0%, 100% {
                box-shadow: 0 0 0 3px rgba(147, 51, 234, 0.2);
              }
              50% {
                box-shadow: 0 0 0 6px rgba(147, 51, 234, 0.1);
              }
            }
            .status-text {
              font-size: 12px;
              color: #666;
            }
          </style>
        </head>
        <body>
          <div class="dashboard-layout">
            <!-- Header -->
            <div class="dashboard-header">
              <div class="header-title">Agent Dashboard</div>
              <div class="agent-status-dropdown">
                <select class="status-select" id="agentStatus" onchange="updateAgentStatus()">
                  <option value="available">🟢 Available</option>
                  <option value="busy">🟡 Busy</option>
                  <option value="offline">🔴 Offline</option>
                </select>
              </div>
            </div>

            <!-- Left Panel: Agent Chat -->
            <div class="left-panel">
              <div class="panel-title">Active Chat Session</div>
              <div class="connection-status">
                <div class="status-dot" id="connectionDot"></div>
                <span class="status-text" id="connectionText">Connected to WebSocket</span>
              </div>
              <div class="chat-container">
                <div class="chat-messages" id="chatMessages">
                  <div class="message bot">Hi! I am your bot. Ask your queries.</div>
                </div>
                <div class="chat-input">
                  <input type="text" id="messageInput" placeholder="Type your message..." onkeypress="handleKeyPress(event)">
                  <button onclick="sendMessage()">Send</button>
                </div>
              </div>
            </div>

            <!-- Middle Panel: Customer Queue -->
            <div class="middle-panel">
              <div class="panel-title">Customer Queue & Sessions</div>
              <div class="stats-grid">
                <div class="stat-card">
                  <div class="stat-number" id="activeCount">3</div>
                  <div class="stat-label">Active</div>
                </div>
                <div class="stat-card">
                  <div class="stat-number" id="queueCount">5</div>
                  <div class="stat-label">In Queue</div>
                </div>
              </div>
              <div class="customer-queue" id="customerQueue">
                <!-- Queue items will be populated here -->
              </div>
            </div>

            <!-- Right Panel: AI Agent Assistant -->
            <div class="right-panel">
              <div class="panel-title">AI Agent Assistant</div>
              <div class="ai-suggestions">
                <div class="suggestion-item" onclick="applySuggestion('greeting')">
                  <div class="suggestion-title">Greeting Template</div>
                  <div class="suggestion-text">Hello! How can I assist you today?</div>
                </div>
                <div class="suggestion-item" onclick="applySuggestion('leave_policy')">
                  <div class="suggestion-title">Leave Policy Info</div>
                  <div class="suggestion-text">Employees get 20 paid leaves annually...</div>
                </div>
                <div class="suggestion-item" onclick="applySuggestion('escalate')">
                  <div class="suggestion-title">Escalation</div>
                  <div class="suggestion-text">Let me connect you with a supervisor...</div>
                </div>
              </div>
              <div class="action-buttons">
                <button class="action-btn" onclick="transferChat()">Transfer</button>
                <button class="action-btn" onclick="escalateChat()">Escalate</button>
                <button class="action-btn" onclick="endChat()">End Chat</button>
              </div>
            </div>
          </div>

          <script>
            let ws = null;
            let currentSessionId = null;
            let agentStatus = 'available';
            
            // Initialize WebSocket connection
            function initWebSocket() {
              ws = new WebSocket('ws://localhost:8080');
              
              ws.onopen = function() {
                console.log('Agent connected to WebSocket');
                updateConnectionStatus(true);
                // Identify as agent
                ws.send(JSON.stringify({
                  type: 'agent_connect',
                  agentId: 'agent-001'
                }));
              };
              
              ws.onmessage = function(event) {
                const data = JSON.parse(event.data);
                
                if (data.type === 'queue_update') {
                  updateCustomerQueue(data.queue);
                } else if (data.type === 'agent_connected') {
                  console.log('Agent connected:', data.agentId);
                  updateCustomerQueue(data.queue);
                } else {
                  displayMessage(data.response || data.message, 'bot');
                }
              };
              
              ws.onclose = function() {
                console.log('WebSocket connection closed');
                updateConnectionStatus(false);
              };
              
              ws.onerror = function(error) {
                console.error('WebSocket error:', error);
                updateConnectionStatus(false);
              };
            }
            
            function updateConnectionStatus(connected) {
              const dot = document.getElementById('connectionDot');
              const text = document.getElementById('connectionText');
              
              if (connected) {
                dot.style.background = '#9333ea';
                dot.style.boxShadow = '0 0 0 3px rgba(147, 51, 234, 0.2)';
                text.textContent = 'Connected to WebSocket';
                text.style.color = '#9333ea';
              } else {
                dot.style.background = '#dc3545';
                dot.style.boxShadow = '0 0 0 3px rgba(220, 53, 69, 0.2)';
                text.textContent = 'Disconnected';
                text.style.color = '#dc3545';
              }
            }
            
            function sendMessage() {
              const input = document.getElementById('messageInput');
              const message = input.value.trim();
              
              if (message && ws && ws.readyState === WebSocket.OPEN) {
                displayMessage(message, 'user');
                ws.send(JSON.stringify({
                  message: message,
                  sessionId: currentSessionId || 'agent-session',
                  agentId: 'agent-001'
                }));
                input.value = '';
              }
            }
            
            function handleKeyPress(event) {
              if (event.key === 'Enter') {
                sendMessage();
              }
            }
            
            function displayMessage(text, sender) {
              const messagesContainer = document.getElementById('chatMessages');
              const messageDiv = document.createElement('div');
              messageDiv.className = \`message \${sender}\`;
              messageDiv.textContent = text;
              messagesContainer.appendChild(messageDiv);
              messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
            
            function updateAgentStatus() {
              const select = document.getElementById('agentStatus');
              agentStatus = select.value;
              console.log('Agent status changed to:', agentStatus);
              
              // Update queue assignment based on status
              if (agentStatus === 'available') {
                assignNextCustomer();
              }
            }
            
            function assignNextCustomer() {
              // Round-robin assignment logic
              const queueItems = document.querySelectorAll('.queue-item');
              const waitingCustomers = Array.from(queueItems).filter(item => 
                !item.classList.contains('active')
              );
              
              if (waitingCustomers.length > 0 && agentStatus === 'available') {
                const nextCustomer = waitingCustomers[0];
                nextCustomer.classList.add('active');
                nextCustomer.querySelector('.queue-status').textContent = 'In Progress';
                nextCustomer.querySelector('.queue-status').className = 'queue-status in-progress';
                
                // Update session ID
                currentSessionId = nextCustomer.dataset.sessionId;
                console.log('Assigned customer:', currentSessionId);
              }
            }
            
            function applySuggestion(type) {
              const input = document.getElementById('messageInput');
              
              switch(type) {
                case 'greeting':
                  input.value = 'Hello! How can I assist you today?';
                  break;
                case 'leave_policy':
                  input.value = 'Employees get 20 paid leaves annually. Would you like to check your leave balance?';
                  break;
                case 'escalate':
                  input.value = 'Let me connect you with a supervisor who can better assist you.';
                  break;
              }
            }
            
            function transferChat() {
              console.log('Transferring chat to another agent');
              alert('Chat transfer initiated');
            }
            
            function escalateChat() {
              console.log('Escalating chat to supervisor');
              alert('Chat escalated to supervisor');
            }
            
            function endChat() {
              if (currentSessionId) {
                console.log('Ending chat session:', currentSessionId);
                // Remove from queue
                const activeItem = document.querySelector('.queue-item.active');
                if (activeItem) {
                  activeItem.remove();
                }
                currentSessionId = null;
                
                // Clear chat
                document.getElementById('chatMessages').innerHTML = 
                  '<div class="message bot">Hi! I am your bot. Ask your queries.</div>';
                
                // Assign next customer
                setTimeout(assignNextCustomer, 1000);
              }
            }
            
            function populateQueue() {
              const queue = document.getElementById('customerQueue');
              const customers = [
                { id: 'session-001', name: 'John Doe', query: 'Leave balance inquiry', waitTime: '2 min' },
                { id: 'session-002', name: 'Jane Smith', query: 'Office timing question', waitTime: '5 min' },
                { id: 'session-003', name: 'Mike Johnson', query: 'WFH policy clarification', waitTime: '1 min' },
                { id: 'session-004', name: 'Sarah Wilson', query: 'Employee benefits info', waitTime: '8 min' },
                { id: 'session-005', name: 'David Brown', query: 'Vacation request help', waitTime: '3 min' },
                { id: 'session-006', name: 'Lisa Garcia', query: 'Payroll question', waitTime: '6 min' }
              ];
              
              customers.forEach((customer, index) => {
                const item = document.createElement('div');
                item.className = 'queue-item';
                item.dataset.sessionId = customer.id;
                
                item.innerHTML = \`
                  <div class="customer-info">
                    <span class="customer-name">\${customer.name}</span>
                    <span class="wait-time">\${customer.waitTime}</span>
                  </div>
                  <div class="customer-query">\${customer.query}</div>
                  <div class="queue-status">\${index === 0 ? 'In Progress' : 'Waiting'}</div>
                \`;
                
                if (index === 0) {
                  item.classList.add('active');
                  item.querySelector('.queue-status').className = 'queue-status in-progress';
                  currentSessionId = customer.id;
                }
                
                queue.appendChild(item);
              });
            }
            
            // Initialize dashboard
            window.onload = function() {
              initWebSocket();
              populateQueue();
            };
          </script>
        </body>
        </html>
      `);
      
      dashboardWindow.document.close();
      dashboardWindow.focus();
    }
  };

  return (
    <button 
      className="agent-dashboard-btn"
      onClick={openAgentDashboard}
    >
      Agent Dashboard
    </button>
  );
};

export default AgentDashboard;