#pragma once

#include <string>
#include <unordered_map>
#include <mutex>
#include <random>

class Session {
private:
    std::unordered_map<std::string, std::string> tokenToUser;
    mutable std::mutex mtx;

    static std::string generateToken(size_t len = 32) {
        static const char hexChars[] = "0123456789abcdef";
        std::random_device rd;
        std::mt19937 gen(rd());
        std::uniform_int_distribution<size_t> dis(0, 15);
        std::string token;
        token.reserve(len);
        for (size_t i = 0; i < len; ++i) {
            token += hexChars[dis(gen)];
        }
        return token;
    }

public:
    Session() = default;

    std::string create(const std::string& username) {
        std::lock_guard<std::mutex> lock(mtx);
        std::string token = generateToken(32);
        tokenToUser[token] = username;
        return token;
    }

    std::string userFor(const std::string& token) const {
        std::lock_guard<std::mutex> lock(mtx);
        auto it = tokenToUser.find(token);
        if (it != tokenToUser.end()) {
            return it->second;
        }
        return "";
    }

    void remove(const std::string& token) {
        std::lock_guard<std::mutex> lock(mtx);
        tokenToUser.erase(token);
    }
};
