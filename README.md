# FitTrack
A C++17 object-oriented fitness tracker web application.

## Local Run
1. `bash setup.sh`
2. `g++ -std=c++17 -O2 -pthread backend/main.cpp -o server && ./server`
3. Open `http://localhost:8080` in your browser.

## Docker & Render
Run `docker build -t fittrack . && docker run -p 10000:10000 -e PORT=10000 fittrack`. On Render: create New Web Service, select Docker runtime, deploy. Note: Render free tier wipes the local data/ folder on redeploy.
