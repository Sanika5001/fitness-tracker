#pragma once

#include <string>
#include <map>
#include <mutex>
#include <regex>
#include <random>
#include "User.h"
#include "Storage.h"
#include "third_party/picosha2.h"

class UserManager {
private:
    std::map<std::string, User> users;
    mutable std::mutex mtx;

    static std::string generateSalt(size_t len = 16) {
        static const char hexChars[] = "0123456789abcdef";
        std::random_device rd;
        std::mt19937 gen(rd());
        std::uniform_int_distribution<size_t> dis(0, 15);
        std::string s;
        s.reserve(len);
        for (size_t i = 0; i < len; ++i) {
            s += hexChars[dis(gen)];
        }
        return s;
    }

    static bool isValidUsername(const std::string& username) {
        static const std::regex rgx("^[a-zA-Z0-9_]{3,20}$");
        return std::regex_match(username, rgx);
    }

public:
    UserManager() {
        loadAll();
    }

    void loadAll() {
        std::lock_guard<std::mutex> lock(mtx);
        users.clear();
        auto loaded = Storage::loadAllUsers();
        for (auto& u : loaded) {
            users[u.getUsername()] = std::move(u);
        }
    }

    bool registerUser(const std::string& username, const std::string& password, double weight, std::string& errorMsg) {
        if (!isValidUsername(username)) {
            errorMsg = "Username must be 3-20 alphanumeric or underscore characters.";
            return false;
        }
        if (password.length() < 6) {
            errorMsg = "Password must be at least 6 characters.";
            return false;
        }
        if (weight < 20.0 || weight > 300.0) {
            errorMsg = "Weight must be between 20 and 300 kg.";
            return false;
        }

        std::lock_guard<std::mutex> lock(mtx);
        if (users.find(username) != users.end()) {
            errorMsg = "Username already exists.";
            return false;
        }

        std::string salt = generateSalt(16);
        std::string hash = picosha2::hash256_hex_string(salt + password);

        User newUser(username, salt, hash, weight, 500.0);
        if (!Storage::saveUser(newUser)) {
            errorMsg = "Failed to save user data.";
            return false;
        }

        users[username] = std::move(newUser);
        return true;
    }

    bool verify(const std::string& username, const std::string& password) const {
        std::lock_guard<std::mutex> lock(mtx);
        auto it = users.find(username);
        if (it == users.end()) {
            return false;
        }

        std::string checkHash = picosha2::hash256_hex_string(it->second.getSalt() + password);
        return checkHash == it->second.getPasswordHash();
    }

    bool getUser(const std::string& username, User& outUser) const {
        std::lock_guard<std::mutex> lock(mtx);
        auto it = users.find(username);
        if (it != users.end()) {
            outUser = it->second;
            return true;
        }
        return false;
    }

    bool save(const std::string& username) {
        std::lock_guard<std::mutex> lock(mtx);
        auto it = users.find(username);
        if (it != users.end()) {
            return Storage::saveUser(it->second);
        }
        return false;
    }

    bool logExercise(const std::string& username, std::shared_ptr<Exercise> ex, std::shared_ptr<Exercise>& outEx) {
        if (!ex) return false;
        std::lock_guard<std::mutex> lock(mtx);
        auto it = users.find(username);
        if (it == users.end()) return false;

        if (ex->getCalories() <= 0.0) {
            ex->calculateCalories(it->second.getWeightKg());
        }
        if (ex->getDate().empty()) {
            ex->setDate(DateHelper::getFormattedDate(0));
        }

        it->second.logExercise(ex);
        Storage::saveUser(it->second);
        outEx = ex;
        return true;
    }

    bool updateProfile(const std::string& username, double weight, double dailyGoal, std::string& errorMsg) {
        if (weight < 20.0 || weight > 300.0) {
            errorMsg = "Weight must be between 20 and 300 kg.";
            return false;
        }
        if (dailyGoal < 50.0 || dailyGoal > 10000.0) {
            errorMsg = "Daily goal must be between 50 and 10000 kcal.";
            return false;
        }
        std::lock_guard<std::mutex> lock(mtx);
        auto it = users.find(username);
        if (it == users.end()) {
            errorMsg = "User not found.";
            return false;
        }
        it->second.setWeightKg(weight);
        it->second.setDailyGoal(dailyGoal);
        Storage::saveUser(it->second);
        return true;
    }

    bool addPlan(const std::string& username, const WorkoutPlan& plan, std::string& errorMsg) {
        if (plan.getPlanName().empty()) {
            errorMsg = "Plan name cannot be empty.";
            return false;
        }
        std::lock_guard<std::mutex> lock(mtx);
        auto it = users.find(username);
        if (it == users.end()) {
            errorMsg = "User not found.";
            return false;
        }

        it->second.addPlan(plan);
        Storage::saveUser(it->second);
        return true;
    }

    bool addExerciseToPlan(const std::string& username, const std::string& planName,
                           std::shared_ptr<Exercise> ex, WorkoutPlan& outPlan, std::string& errorMsg) {
        if (!ex) {
            errorMsg = "Invalid exercise.";
            return false;
        }
        std::lock_guard<std::mutex> lock(mtx);
        auto it = users.find(username);
        if (it == users.end()) {
            errorMsg = "User not found.";
            return false;
        }

        WorkoutPlan* plan = it->second.getPlan(planName);
        if (!plan) {
            errorMsg = "Workout plan not found.";
            return false;
        }

        if (ex->getCalories() <= 0.0) {
            ex->calculateCalories(it->second.getWeightKg());
        }
        plan->addExercise(ex);
        Storage::saveUser(it->second);
        outPlan = *plan;
        return true;
    }
};
