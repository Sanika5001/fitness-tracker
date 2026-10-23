#pragma once

#include <string>
#include <vector>
#include <fstream>
#include <filesystem>
#include <iostream>
#include "User.h"
#include "third_party/json.hpp"

class Storage {
public:
    static std::string getUserFilePath(const std::string& username) {
        return "data/users/" + username + ".json";
    }

    static bool saveUser(const User& user) {
        try {
            std::filesystem::create_directories("data/users");
            std::string path = getUserFilePath(user.getUsername());
            std::ofstream out(path);
            if (!out.is_open()) {
                return false;
            }
            out << user.toJson().dump(2);
            return true;
        } catch (const std::exception& e) {
            std::cerr << "Storage save error: " << e.what() << std::endl;
            return false;
        }
    }

    static bool loadUser(const std::string& username, User& user) {
        try {
            std::string path = getUserFilePath(username);
            if (!std::filesystem::exists(path)) {
                return false;
            }
            std::ifstream in(path);
            if (!in.is_open()) {
                return false;
            }
            nlohmann::json j;
            in >> j;
            user = User::fromJson(j);
            return true;
        } catch (const std::exception& e) {
            std::cerr << "Storage load error for " << username << ": " << e.what() << std::endl;
            return false;
        }
    }

    static std::vector<User> loadAllUsers() {
        std::vector<User> list;
        try {
            if (!std::filesystem::exists("data/users")) {
                std::filesystem::create_directories("data/users");
                return list;
            }
            for (const auto& entry : std::filesystem::directory_iterator("data/users")) {
                if (entry.is_regular_file() && entry.path().extension() == ".json") {
                    try {
                        std::ifstream in(entry.path());
                        if (in.is_open()) {
                            nlohmann::json j;
                            in >> j;
                            list.push_back(User::fromJson(j));
                        }
                    } catch (const std::exception& ex) {
                        std::cerr << "Failed reading user file " << entry.path() << ": " << ex.what() << std::endl;
                    }
                }
            }
        } catch (const std::exception& e) {
            std::cerr << "Storage loadAllUsers error: " << e.what() << std::endl;
        }
        return list;
    }
};
