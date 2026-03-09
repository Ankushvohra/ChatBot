from flask import Flask, request, jsonify, session
from flask_cors import CORS
import csv
import os

app = Flask(__name__)
app.secret_key = 'chatbot-session-secret-2024'
CORS(app, supports_credentials=True, origins=['http://localhost:3000'])

USERS_CSV = os.path.join(os.path.dirname(__file__), 'users.csv')

def load_users():
    users = {}
    with open(USERS_CSV, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            users[row['email']] = row
    return users

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    
    users = load_users()
    user = users.get(email)
    
    if not user or user['password'] != password:
        return jsonify({'error': 'Invalid credentials'}), 401
    
    if user['active'] != 'true':
        return jsonify({'error': 'Account inactive'}), 403
    
    session['user'] = {
        'uid': user['uid'],
        'email': email,
        'name': user['name'],
        'role': user['role']
    }
    
    return jsonify({
        'success': True,
        'user': session['user']
    })

@app.route('/api/auth/logout', methods=['POST'])
def logout():
    session.pop('user', None)
    return jsonify({'success': True})

if __name__ == '__main__':
    print("Auth Server on port 5001")
    app.run(debug=True, port=5001)
