from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import ssl
import urllib3
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# Disable SSL warnings and create custom session
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

class SSLAdapter(HTTPAdapter):
    def init_poolmanager(self, *args, **kwargs):
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        kwargs['ssl_context'] = ctx
        return super().init_poolmanager(*args, **kwargs)

session = requests.Session()
session.mount('https://', SSLAdapter())
import jwt
from datetime import datetime, timedelta

app = Flask(__name__)
CORS(app)

# Your Supabase credentials
SUPABASE_URL = "https://nrzvjobgvdmgjnpnxgwj.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5yenZqb2JndmRtZ2pucG54Z3dqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMDk3MTEsImV4cCI6MjA4NzU4NTcxMX0.qhDvnlMY8YLNiojrw_DID_0CL4PLINvpF5d3UzLpbOc"

JWT_SECRET = 'chatbot-secret-key-2024'

@app.route('/api/auth/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')
        
        print(f"Login attempt for: {email}")
        
        # Authenticate with Supabase REST API
        auth_url = f"{SUPABASE_URL}/auth/v1/token?grant_type=password"
        auth_response = session.post(auth_url, 
            headers={"apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json"},
            json={"email": email, "password": password},
            timeout=30
        )
        
        if auth_response.status_code == 200:
            auth_data = auth_response.json()
            user_id = auth_data['user']['id']
            access_token = auth_data['access_token']
            
            print(f"User authenticated: {user_id}")
            
            # Get user profile
            profile_url = f"{SUPABASE_URL}/rest/v1/profiles?id=eq.{user_id}&select=*"
            profile_response = session.get(profile_url,
                headers={"apikey": SUPABASE_ANON_KEY, "Authorization": f"Bearer {access_token}"},
                timeout=30
            )
            
            if profile_response.status_code == 200:
                profiles = profile_response.json()
                
                if not profiles:
                    print("Profile not found")
                    return jsonify({'error': 'Profile not found'}), 404
                
                profile = profiles[0]
                print(f"Profile found: {profile}")
                
                # Check role and active status
                if not profile.get('active') or profile.get('role') not in ['admin', 'agent']:
                    print(f"Access denied for role: {profile.get('role')}")
                    return jsonify({'error': 'Access denied'}), 403
                
                # Generate JWT token
                payload = {
                    'uid': user_id,
                    'email': email,
                    'role': profile['role'],
                    'name': profile['name'],
                    'exp': datetime.utcnow() + timedelta(hours=8)
                }
                
                token = jwt.encode(payload, JWT_SECRET, algorithm='HS256')
                
                return jsonify({
                    'success': True,
                    'token': token,
                    'user': {
                        'uid': user_id,
                        'email': email,
                        'name': profile['name'],
                        'role': profile['role']
                    }
                })
            else:
                print(f"Profile fetch failed: {profile_response.status_code}")
                return jsonify({'error': 'Profile not found'}), 404
        else:
            print(f"Auth failed: {auth_response.status_code}")
            return jsonify({'error': 'Invalid credentials'}), 401
        
    except Exception as e:
        print(f"Login error: {e}")
        return jsonify({'error': 'Authentication failed'}), 500

@app.route('/api/auth/verify', methods=['POST'])
def verify_token():
    try:
        auth_header = request.headers.get('Authorization')
        token = auth_header.split(' ')[1] if auth_header else None
        
        if not token:
            return jsonify({'error': 'Token required'}), 401
        
        payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
        
        return jsonify({
            'valid': True,
            'user': {
                'uid': payload['uid'],
                'email': payload['email'],
                'name': payload['name'],
                'role': payload['role']
            }
        })
        
    except jwt.ExpiredSignatureError:
        return jsonify({'error': 'Token expired'}), 401
    except jwt.InvalidTokenError:
        return jsonify({'error': 'Invalid token'}), 401

@app.route('/api/auth/logout', methods=['POST'])
def logout():
    return jsonify({'success': True, 'message': 'Logged out successfully'})

if __name__ == '__main__':
    print("Supabase REST Auth Server starting...")
    print("Project URL: https://nrzvjobgvdmgjnpnxgwj.supabase.co")
    print("Login credentials:")
    print("Admin: admin@company.com / Admin123!")
    print("Agent1: agent1@company.com / Agent123!")
    print("Agent2: agent2@company.com / Agent123!")
    app.run(debug=True, port=5001)