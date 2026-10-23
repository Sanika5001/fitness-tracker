#!/usr/bin/env bash
set -e
mkdir -p backend/third_party
curl -sSL https://raw.githubusercontent.com/yhirose/cpp-httplib/v0.18.0/httplib.h -o backend/third_party/httplib.h
curl -sSL https://github.com/nlohmann/json/releases/download/v3.11.3/json.hpp -o backend/third_party/json.hpp
curl -sSL https://raw.githubusercontent.com/okdshin/PicoSHA2/master/picosha2.h -o backend/third_party/picosha2.h
echo "Dependencies downloaded successfully."
