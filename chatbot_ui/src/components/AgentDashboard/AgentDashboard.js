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
          <title>Agent Login</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              height: 100vh;
              display: flex;
              justify-content: center;
              align-items: center;
            }
            .login-container {
              background: white;
              padding: 40px;
              border-radius: 12px;
              box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
              width: 100%;
              max-width: 400px;
            }
            .login-container h2 {
              text-align: center;
              margin-bottom: 10px;
              color: #9333ea;
              font-size: 24px;
              font-weight: 600;
            }
            .login-container p {
              text-align: center;
              margin-bottom: 30px;
              color: #666;
              font-size: 14px;
            }
            .form-group {
              margin-bottom: 20px;
            }
            .form-group input {
              width: 100%;
              padding: 12px 16px;
              border: 2px solid #e2e8f0;
              border-radius: 8px;
              font-size: 16px;
              transition: border-color 0.2s ease;
              outline: none;
            }
            .form-group input:focus {
              border-color: #9333ea;
              box-shadow: 0 0 0 3px rgba(147, 51, 234, 0.1);
            }
            .login-btn {
              width: 100%;
              background: #9333ea;
              color: white;
              border: none;
              padding: 12px;
              border-radius: 8px;
              font-size: 16px;
              font-weight: 600;
              cursor: pointer;
              transition: background-color 0.2s ease;
            }
            .login-btn:hover:not(:disabled) {
              background: #7c3aed;
            }
            .login-btn:disabled {
              opacity: 0.6;
              cursor: not-allowed;
            }
            .error-message {
              color: #dc3545;
              font-size: 14px;
              margin-bottom: 15px;
              text-align: center;
              padding: 8px;
              background: #f8d7da;
              border-radius: 4px;
              display: none;
            }
            .demo-credentials {
              margin-top: 20px;
              text-align: center;
            }
            .demo-credentials p {
              font-size: 12px;
              color: #9ca3af;
              background: #f3f4f6;
              padding: 8px;
              border-radius: 4px;
              margin: 4px 0;
            }
            
            /* Dashboard Styles */
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
            }
            .user-info {
              display: flex;
              align-items: center;
              gap: 15px;
              font-size: 12px;
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
              border: none;
              padding: 6px 12px;
              border-radius: 6px;
              cursor: pointer;
              font-weight: 600;
              font-size: 12px;
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
            }
            .status-text {
              font-size: 12px;
              color: #666;
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
            }
          </style>
        </head>
        <body>
          <div class="login-container" id="loginContainer">
            <h2>Agent Login</h2>
            <p>Please sign in to access the dashboard</p>
            <form onsubmit="handleLogin(event)">
              <div class="form-group">
                <input type="email" id="email" placeholder="Email" required>
              </div>
              <div class="form-group">
                <input type="password" id="password" placeholder="Password" required>
              </div>
              <div class="error-message" id="errorMessage"></div>
              <button type="submit" class="login-btn" id="loginBtn">Login</button>
            </form>
            <div class="demo-credentials">
              <p><strong>Demo Accounts:</strong></p>
              <p>Admin: admin@company.com / Admin123!</p>
              <p>Agent: agent1@company.com / Agent123!</p>
            </div>
          </div>
          
          <script>
            let currentUser = null;
            
            async function handleLogin(event) {
              event.preventDefault();
              
              const email = document.getElementById('email').value;
              const password = document.getElementById('password').value;
              const errorDiv = document.getElementById('errorMessage');
              const loginBtn = document.getElementById('loginBtn');
              
              loginBtn.disabled = true;
              loginBtn.textContent = 'Signing in...';
              errorDiv.style.display = 'none';
              
              try {
                const response = await fetch('http://localhost:5001/api/auth/login', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ email, password }),
                });

                const data = await response.json();

                if (data.success) {
                  currentUser = data.user;
                  loadDashboard();
                } else {
                  errorDiv.textContent = data.error || 'Login failed';
                  errorDiv.style.display = 'block';
                }
              } catch (error) {
                errorDiv.textContent = 'Network error. Please try again.';
                errorDiv.style.display = 'block';
              }
              
              loginBtn.disabled = false;
              loginBtn.textContent = 'Login';
            }
            
            function loadDashboard() {
              const dashboardTitle = currentUser.role === 'admin' ? 'Admin Dashboard' : 'Agent Dashboard';
              
              document.body.style.background = '#f8f9fa';
              document.body.style.height = '100vh';
              document.body.style.overflow = 'hidden';
              document.body.style.display = 'block';
              document.title = dashboardTitle + ' - ' + currentUser.name;
              
              document.body.innerHTML = \`
                <div class="dashboard-layout">
                  <div class="dashboard-header">
                    <div class="header-title">\${dashboardTitle} - \${currentUser.name}</div>
                    <div class="user-info">
                      <span>Role: \${currentUser.role.toUpperCase()}</span>
                      <select class="status-select" id="agentStatus" onchange="updateAgentStatus()">
                        <option value="available">Available</option>
                        <option value="busy">Busy</option>
                        <option value="offline">Offline</option>
                      </select>
                    </div>
                  </div>

                  <div class="left-panel">
                    <div class="panel-title">Active Chat Session</div>
                    <div class="connection-status">
                      <div class="status-dot" id="connectionDot"></div>
                      <span class="status-text" id="connectionText">Ready to connect</span>
                    </div>
                    <div class="chat-container">
                      <div class="chat-messages" id="chatMessages">
                        <div class="message bot">Welcome \${currentUser.name}! You are logged in as \${currentUser.role}.</div>
                      </div>
                      <div class="chat-input">
                        <input type="text" id="messageInput" placeholder="Type your message..." onkeypress="handleKeyPress(event)">
                        <button onclick="sendMessage()">Send</button>
                      </div>
                    </div>
                  </div>

                  <div class="middle-panel">
                    <div class="panel-title">Customer Queue & Sessions</div>
                    <div class="stats-grid">
                      <div class="stat-card">
                        <div class="stat-number" id="activeCount">0</div>
                        <div class="stat-label">Active</div>
                      </div>
                      <div class="stat-card">
                        <div class="stat-number" id="queueCount">0</div>
                        <div class="stat-label">In Queue</div>
                      </div>
                    </div>
                    <div class="customer-queue" id="customerQueue">
                      <div style="text-align: center; color: #666; padding: 20px;">No customers in queue</div>
                    </div>
                  </div>

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
              \`;
              
              initDashboard();
            }
            
            function initDashboard() {
              let ws = null;
              let currentSessionId = null;
              
              function initWebSocket() {
                ws = new WebSocket('ws://localhost:8080');
                
                ws.onopen = function() {
                  ws.send(JSON.stringify({ 
                    type: 'agent_connect', 
                    agentId: 'agent-001',
                    role: currentUser.role,
                    userId: currentUser.uid
                  }));
                  document.getElementById('connectionText').textContent = 'Connected';
                  document.getElementById('connectionDot').style.background = '#22c55e';
                };
                
                ws.onmessage = function(event) {
                  const data = JSON.parse(event.data);
                  
                  if (data.type === 'session_limit_error') {
                    alert(data.message);
                    window.close();
                    return;
                  }
                  
                  if (data.type === 'user_connected') {
                    currentSessionId = data.sessionId;
                    appendMessage('--- Chat history ---', 'bot');
                    (data.history || []).forEach(function(entry) {
                      var label = entry.sender === 'user' ? 'User' : entry.sender === 'bot' ? 'Bot' : 'Agent';
                      appendMessage(label + ': ' + entry.message, entry.sender === 'user' ? 'user' : 'bot');
                    });
                    appendMessage('--- User is now live ---', 'bot');
                  } else if (data.type === 'user_message') {
                    appendMessage('User: ' + data.message, 'bot');
                  } else if (data.type === 'user_disconnected') {
                    appendMessage('System: ' + data.message, 'bot');
                    currentSessionId = null; // Clear current session
                  } else if (data.type === 'agent_connected' || data.type === 'stats_update') {
                    document.getElementById('activeCount').textContent = data.activeCount || 0;
                    document.getElementById('queueCount').textContent = data.queueCount || 0;
                    
                    // Update queue display
                    const queueContainer = document.getElementById('customerQueue');
                    if (data.queue && data.queue.length > 0) {
                      queueContainer.innerHTML = data.queue.map(customer => 
                        '<div style="padding: 8px; border: 1px solid #e2e8f0; border-radius: 4px; margin-bottom: 4px; font-size: 12px;">' +
                          '<strong>Customer:</strong> ' + customer.id.substring(0, 8) + '...<br>' +
                          '<span style="color: #666;">Waiting: ' + customer.waiting_time + '</span>' +
                        '</div>'
                      ).join('');
                    } else {
                      queueContainer.innerHTML = '<div style="text-align: center; color: #666; padding: 20px;">No customers in queue</div>';
                    }
                  }
                };
                
                ws.onclose = function() {
                  document.getElementById('connectionText').textContent = 'Disconnected';
                  document.getElementById('connectionDot').style.background = '#dc3545';
                };
              }
              
              function appendMessage(text, type) {
                const container = document.getElementById('chatMessages');
                const div = document.createElement('div');
                div.className = 'message ' + type;
                div.textContent = text;
                container.appendChild(div);
                container.scrollTop = container.scrollHeight;
              }
              
              window.sendMessage = function() {
                const input = document.getElementById('messageInput');
                const message = input.value.trim();
                if (message && ws && ws.readyState === WebSocket.OPEN && currentSessionId) {
                  ws.send(JSON.stringify({ type: 'agent_message', sessionId: currentSessionId, message }));
                  appendMessage('You: ' + message, 'user');
                  input.value = '';
                }
              };
              
              window.handleKeyPress = function(event) {
                if (event.key === 'Enter') sendMessage();
              };
              
              window.updateAgentStatus = function() {
                const status = document.getElementById('agentStatus').value;
                if (ws && ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({ type: 'agent_status', status }));
                }
              };
              
              window.applySuggestion = function(type) {
                const input = document.getElementById('messageInput');
                const suggestions = {
                  greeting: 'Hello! How can I assist you today?',
                  leave_policy: 'Employees get 20 paid leaves annually.',
                  escalate: 'Let me connect you with a supervisor.'
                };
                input.value = suggestions[type] || '';
              };
              
              window.endChat = function() {
                if (currentSessionId && ws && ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({ type: 'end_chat', sessionId: currentSessionId }));
                  appendMessage('System: Chat ended by agent', 'bot');
                  currentSessionId = null;
                }
              };
              
              window.transferChat = function() { alert('Transfer initiated'); };
              window.escalateChat = function() { alert('Escalated to supervisor'); };
              
              initWebSocket();
            }
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