import React, { useState, useEffect, useRef } from 'react';
import './ChatBot.css';

const ChatBot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [keepPopupOpen, setKeepPopupOpen] = useState(false);
  const [ws, setWs] = useState(null);
  const [size, setSize] = useState({ width: 350, height: 500 });
  const [liveTranscript, setLiveTranscript] = useState('');
  const recognitionRef = useRef(null);
  const startSizeRef = useRef({ width: 0, height: 0 });
  const startPosRef = useRef({ x: 0, y: 0 });
  const silenceTimerRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });
  const [popupWidth, setPopupWidth] = useState(220);
  const isDraggingPopup = useRef(false);
  const isResizingPopup = useRef(false);
  const popupStartPos = useRef({ x: 0, y: 0 });
  const popupResizeStart = useRef({ x: 0, width: 0 });
  const chatWindowRef = useRef(null);
  const isPopupInitialized = useRef(false);
  const keepPopupOpenRef = useRef(false);
  const isRecordingRef = useRef(false);
  const manualStopRef = useRef(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const [isSessionExpired, setIsSessionExpired] = useState(false);
  const [sessionId] = useState(() => crypto.randomUUID());



  useEffect(() => {
    keepPopupOpenRef.current = keepPopupOpen;
  }, [keepPopupOpen]);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    const messagesContainer = document.querySelector('.chat-messages');
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{ text: "Hi! I am your bot.\nAsk your queries.", sender: 'bot', time: new Date() }]);
    }
  }, [isOpen, messages.length]);



  useEffect(() => {
    if (isWaiting && isRecording) {
      manualStopRef.current = true;
      try {
        recognitionRef.current?.stop();
      } catch (err) {
        console.error('Stop error:', err);
      }
      clearTimeout(silenceTimerRef.current);
      setVolumeLevel(0);
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      setIsRecording(false);
    }
  }, [isWaiting, isRecording]);

  const handlePopupMouseDown = (e) => {
    if (e.target.closest('.send-button') || e.target.closest('.mic-icon') || e.target.closest('.popup-resize-handle') || e.target.closest('.toggle-switch')) return;
    e.preventDefault();
    isDraggingPopup.current = true;
    const popup = e.currentTarget;
    const rect = popup.getBoundingClientRect();
    popupStartPos.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handlePopupResizeMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    isResizingPopup.current = true;
    popupResizeStart.current = { x: e.clientX, width: popupWidth };
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDraggingPopup.current && chatWindowRef.current) {
        const chatRect = chatWindowRef.current.getBoundingClientRect();
        const newX = e.clientX - chatRect.left - popupStartPos.current.x;
        const newY = e.clientY - chatRect.top - popupStartPos.current.y;
        
        setPopupPosition({
          x: Math.max(10, Math.min(size.width - popupWidth - 10, newX)),
          y: Math.max(60, Math.min(size.height - 180, newY))
        });
      }
      
      if (isResizingPopup.current) {
        const deltaX = e.clientX - popupResizeStart.current.x;
        const newWidth = Math.max(150, Math.min(500, popupResizeStart.current.width + deltaX));
        setPopupWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      isDraggingPopup.current = false;
      isResizingPopup.current = false;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [popupPosition, size.width, size.height, popupWidth]);

  const downloadFile = (data, filename, type) => {
    const blob = new Blob([atob(data)], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const parseHtmlContent = (text) => {
    if (!text.includes('@@htmlstart@@')) return text;
    
    return text.replace(/@@htmlstart@@([\s\S]*?)@@htmlend@@/g, (match, htmlContent) => {
      return htmlContent
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&');
    });
  };

  const renderMessageContent = (text) => {
    const parsedText = parseHtmlContent(text);
    
    if (parsedText.includes('<table')) {
      const parts = parsedText.split(/(<table[\s\S]*?<\/table>)/g);
      return parts.map((part, index) => {
        if (part.includes('<table')) {
          return <div key={index} dangerouslySetInnerHTML={{ __html: part }} />;
        }
        return part ? <span key={index}>{part}</span> : null;
      }).filter(Boolean);
    }
    
    return <span>{parsedText}</span>;
  };

  useEffect(() => {
    if (!isOpen) return;
    
    const websocket = new WebSocket('ws://localhost:8080');
    
    websocket.onopen = () => console.log('Connected to WebSocket');
    
    websocket.onclose = () => {
      console.log('WebSocket connection closed');
    };
    websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'session_expired') {
          setIsSessionExpired(true);
          setMessages(prev => [...prev, { 
            text: data.response, 
            sender: 'bot', 
            time: new Date() 
          }]);
          return;
        }
        
        if (data.type === 'status') {
          setMessages(prev => {
            const lastMsg = prev[prev.length - 1];
            if (lastMsg && lastMsg.isStatus) {
              return [...prev.slice(0, -1), { text: data.message, sender: 'bot', time: new Date(), isStatus: true }];
            }
            return [...prev, { text: data.message, sender: 'bot', time: new Date(), isStatus: true }];
          });
        } else if (data.type === 'response') {
          setMessages(prev => {
            const filtered = prev.filter(msg => !msg.isStatus);
            return [...filtered, { text: data.message, sender: 'bot', time: new Date() }];
          });
          setIsWaiting(false);
        } else if (data.file) {
          const messageWithDownload = {
            text: data.response,
            sender: 'bot',
            time: new Date(),
            file: data.file
          };
          setMessages(prev => [...prev, messageWithDownload]);
          setIsWaiting(false);
        } else {
          setMessages(prev => [...prev, { text: data.response, sender: 'bot', time: new Date() }]);
          setIsWaiting(false);
        }
      } catch (error) {
        setMessages(prev => [...prev, { text: event.data, sender: 'bot', time: new Date() }]);
        setIsWaiting(false);
      }
    };
    websocket.onerror = (error) => console.error('WebSocket error:', error);
    
    setWs(websocket);
    
    return () => websocket.close();
  }, [isOpen]);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      
      recognitionRef.current.onresult = (event) => {
        if (!isRecordingRef.current) return;
        
        let interim = '';
        let final = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            final += transcript;
          } else {
            interim += transcript;
          }
        }
        
        const currentText = final || interim;
        setLiveTranscript(currentText);
        
        if (currentText) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = setTimeout(() => {
            if (currentText.trim() && isRecordingRef.current && !isWaiting) {
              if (ws) {
                setMessages(prev => [...prev, { text: currentText, sender: 'user', time: new Date() }]);
                ws.send(JSON.stringify({ message: currentText, sessionId }));
                setIsWaiting(true);
              }
              setLiveTranscript('');
              if (!keepPopupOpenRef.current) {
                manualStopRef.current = true;
                recognitionRef.current?.stop();
                setIsRecording(false);
                setShowPopup(false);
                setVolumeLevel(0);
                if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
                  audioContextRef.current.close();
                }
              }
            }
          }, 3000);
        }
      };
      
      recognitionRef.current.onend = () => {
        if (manualStopRef.current) {
          manualStopRef.current = false;
          return;
        }
        if (keepPopupOpenRef.current && isRecordingRef.current) {
          setTimeout(() => {
            try {
              recognitionRef.current?.start();
              setIsRecording(true);
            } catch (err) {
              console.error('Restart error:', err);
            }
          }, 100);
        } else {
          setIsRecording(false);
          setLiveTranscript('');
          clearTimeout(silenceTimerRef.current);
        }
      };
    }
  }, [ws, keepPopupOpen, showPopup, isWaiting]);

  const handleMouseDown = (e) => {
    e.preventDefault();
    startSizeRef.current = { width: size.width, height: size.height };
    startPosRef.current = { x: e.clientX, y: e.clientY };
    
    const handleMouseMove = (e) => {
      const deltaX = startPosRef.current.x - e.clientX;
      
      setSize({
        width: Math.max(300, Math.min(600, startSizeRef.current.width + deltaX)),
        height: size.height
      });
    };
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleHeightMouseDown = (e) => {
    e.preventDefault();
    startSizeRef.current = { width: size.width, height: size.height };
    startPosRef.current = { x: e.clientX, y: e.clientY };
    
    const handleMouseMove = (e) => {
      const deltaY = startPosRef.current.y - e.clientY;
      
      setSize({
        width: size.width,
        height: Math.max(400, Math.min(800, startSizeRef.current.height + deltaY))
      });
    };
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const sendMessage = () => {
    if (isSessionExpired) return;
    
    if (inputText.trim() && ws && !isWaiting) {
      setMessages(prev => [...prev, { text: inputText, sender: 'user', time: new Date() }]);
      ws.send(JSON.stringify({ message: inputText, sessionId }));
      setInputText('');
      setIsWaiting(true);
    }
  };

  const toggleRecording = async () => {
    if (isRecording) {
      manualStopRef.current = true;
      try {
        recognitionRef.current?.stop();
      } catch (err) {
        console.error('Stop error:', err);
      }
      clearTimeout(silenceTimerRef.current);
      setLiveTranscript('');
      setVolumeLevel(0);
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      setIsRecording(false);
    } else {
      if (!showPopup) {
        setShowPopup(true);
        if (!isPopupInitialized.current) {
          setPopupPosition({ x: 20, y: size.height - 250 });
          isPopupInitialized.current = true;
        }
      }
      setLiveTranscript('');
      setIsRecording(true);
      
      try {
        recognitionRef.current?.start();
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        analyserRef.current = audioContextRef.current.createAnalyser();
        const source = audioContextRef.current.createMediaStreamSource(stream);
        source.connect(analyserRef.current);
        analyserRef.current.fftSize = 256;
        
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        
        const detectVolume = () => {
          if (!isRecording && !recognitionRef.current) return;
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          setVolumeLevel(average / 128);
          requestAnimationFrame(detectVolume);
        };
        detectVolume();
      } catch (err) {
        console.error('Microphone access error:', err);
        setIsRecording(false);
      }
    }
  };

  return (
    <>
      {!isOpen && (
        <div className="chat-icon" onClick={() => setIsOpen(true)}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="#9333ea">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
            <circle cx="8" cy="10" r="1.5"/>
            <circle cx="12" cy="10" r="1.5"/>
            <circle cx="16" cy="10" r="1.5"/>
          </svg>
        </div>
      )}
      
      {isOpen && (
        <div className="chat-window" style={{ width: size.width, height: size.height }} ref={chatWindowRef}>
          <div className="resize-handle-height" onMouseDown={handleHeightMouseDown}></div>
          <div className="resize-handle-width" onMouseDown={handleMouseDown}></div>
          
          <div className="chat-header header-shadow">
            <h3>Chat Support</h3>
            <button onClick={() => {
              console.log('Close button clicked, ws state:', ws?.readyState);
              if (ws && ws.readyState === WebSocket.OPEN) {
                console.log('Sending disconnect message');
                ws.send(JSON.stringify({ type: 'disconnect', sessionId }));
                setTimeout(() => {
                  ws.close();
                  setWs(null);
                }, 100);
              } else if (ws) {
                console.log('WebSocket not open, just closing');
                ws.close();
                setWs(null);
              }
              setIsSessionExpired(false);
              setIsOpen(false);
            }}>✕</button>
          </div>
          
          <div className="chat-messages">
            {messages.length > 0 && (
              <div className="date-divider">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
            )}
            {messages.map((msg, idx) => (
              <div key={idx} className={`message ${msg.sender}`}>
                {msg.sender === 'bot' && (
                  <div className="support-name">Support</div>
                )}
                <div>{renderMessageContent(msg.text)}</div>
                {msg.file && (
                  <div className="file-download">
                    <button 
                      className="download-btn"
                      onClick={() => downloadFile(msg.file.data, msg.file.filename, msg.file.type)}
                    >
                      📄 Download {msg.file.filename}
                    </button>
                  </div>
                )}
                <span className="message-time">
                  {msg.time?.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
          
          {showPopup && (
            <div 
              className="recording-popup" 
              style={{ left: `${popupPosition.x}px`, top: `${popupPosition.y}px`, width: `${popupWidth}px` }}
              onMouseDown={handlePopupMouseDown}
            >
              <div className="popup-resize-handle" onMouseDown={handlePopupResizeMouseDown}></div>
              <div className="mic-container">
                {volumeLevel > 0.1 && (
                  <>
                    <div className="wave" style={{ animationPlayState: 'running' }}></div>
                    <div className="wave" style={{ animationPlayState: 'running' }}></div>
                    <div className="wave" style={{ animationPlayState: 'running' }}></div>
                  </>
                )}
                <div className="mic-icon" style={{ transform: `scale(${1 + volumeLevel * 0.2})`, background: isRecording ? '#9333ea' : '#6b7280', opacity: isWaiting ? 0.5 : 1, cursor: isWaiting ? 'not-allowed' : 'pointer' }} onClick={(e) => {
                  e.stopPropagation();
                  if (!isWaiting) {
                    toggleRecording();
                  }
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                  </svg>
                </div>
              </div>
              <div className="transcript-container">
                <div className="transcript-text">
                  {liveTranscript || (isRecording ? 'Listening...' : 'Click mic to start')}
                </div>
                <button className="send-button" onClick={(e) => {
                  e.stopPropagation();
                  if (liveTranscript.trim() && !isWaiting) {
                    if (ws) {
                      setMessages(prev => [...prev, { text: liveTranscript, sender: 'user', time: new Date() }]);
                      ws.send(JSON.stringify({ message: liveTranscript, sessionId }));
                      setIsWaiting(true);
                      setLiveTranscript('');
                      if (!keepPopupOpenRef.current) {
                        manualStopRef.current = true;
                        recognitionRef.current?.stop();
                        setIsRecording(false);
                        setVolumeLevel(0);
                        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
                          audioContextRef.current.close();
                        }
                        setShowPopup(false);
                      }
                    }
                  }
                }} disabled={isWaiting}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                  </svg>
                </button>
              </div>
              <div className="toggle-switch" onClick={(e) => {
                e.stopPropagation();
                setKeepPopupOpen(!keepPopupOpen);
              }}>
                <span style={{ fontSize: '11px', marginRight: '5px' }}>Keep open</span>
                <div className={`switch ${keepPopupOpen ? 'active' : ''}`}>
                  <div className="switch-slider"></div>
                </div>
              </div>
            </div>
          )}
          
          {isWaiting && (
            <div className="waiting-message">
              Please wait...
            </div>
          )}
          
          <div className="chat-input">
            <div className="input-wrapper">
              <input
                type="text"
                value={inputText}
                onChange={(e) => {
                  if (!isSessionExpired) {
                    setInputText(e.target.value);
                  }
                }}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Ask me something..."
                disabled={isWaiting || isSessionExpired}
              />
              <button onClick={() => {
                if (showPopup) {
                  if (isRecording) {
                    try {
                      recognitionRef.current?.stop();
                    } catch (err) {
                      console.error('Stop error:', err);
                    }
                    clearTimeout(silenceTimerRef.current);
                    setVolumeLevel(0);
                    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
                      audioContextRef.current.close();
                    }
                    setIsRecording(false);
                  }
                  setShowPopup(false);
                  setLiveTranscript('');
                } else {
                  toggleRecording();
                }
              }} className={showPopup ? 'recording' : ''} title="Voice input" disabled={isWaiting || isSessionExpired}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                  <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                </svg>
              </button>
              <button onClick={sendMessage} title="Send message" disabled={isWaiting || isSessionExpired}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatBot;
