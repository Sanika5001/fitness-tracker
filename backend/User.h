#pragma once

#include <string>
#include <vector>
#include <memory>
#include <ctime>
#include <iomanip>
#include <sstream>
#include "Exercise.h"
#include "WorkoutPlan.h"
#include "third_party/json.hpp"

namespace DateHelper {
    inline std::tm getLocalTm(std::time_t t) {
        std::tm tm_buf{};
#if defined(_WIN32)
        localtime_s(&tm_buf, &t);
#else
        localtime_r(&t, &tm_buf);
#endif
        return tm_buf;
    }

    inline std::string getFormattedDate(int dayOffset = 0) {
        std::time_t t = std::time(nullptr) + static_cast<std::time_t>(dayOffset * 86400);
        std::tm tm = getLocalTm(t);
        char buf[32];
        std::strftime(buf, sizeof(buf), "%Y-%m-%d", &tm);
        return std::string(buf);
    }

    inline std::string getDayAbbr(int dayOffset = 0) {
        std::time_t t = std::time(nullptr) + static_cast<std::time_t>(dayOffset * 86400);
        std::tm tm = getLocalTm(t);
        char buf[16];
        std::strftime(buf, sizeof(buf), "%a", &tm);
        return std::string(buf);
    }
}

class User {
private:
    std::string username;
    std::string salt;
    std::string passwordHash;
    double weightKg{70.0};
    double dailyGoal{500.0};
    std::vector<std::shared_ptr<Exercise>> log;
    std::vector<WorkoutPlan> plans;

public:
    User() = default;

    User(std::string username, std::string salt, std::string passwordHash, double weightKg, double dailyGoal = 500.0)
        : username(std::move(username)), salt(std::move(salt)), passwordHash(std::move(passwordHash)),
          weightKg(weightKg), dailyGoal(dailyGoal) {}

    const std::string& getUsername() const { return username; }
    const std::string& getSalt() const { return salt; }
    const std::string& getPasswordHash() const { return passwordHash; }
    double getWeightKg() const { return weightKg; }
    double getDailyGoal() const { return dailyGoal; }
    const std::vector<std::shared_ptr<Exercise>>& getLog() const { return log; }
    const std::vector<WorkoutPlan>& getPlans() const { return plans; }

    void setWeightKg(double w) { weightKg = w; }
    void setDailyGoal(double g) { dailyGoal = g; }

    void logExercise(std::shared_ptr<Exercise> ex) {
        if (ex) {
            log.push_back(std::move(ex));
        }
    }

    void addPlan(const WorkoutPlan& plan) {
        plans.push_back(plan);
    }

    WorkoutPlan* getPlan(const std::string& planName) {
        for (auto& plan : plans) {
            if (plan.getPlanName() == planName) {
                return &plan;
            }
        }
        return nullptr;
    }

    double caloriesOn(const std::string& date) const {
        double total = 0.0;
        for (const auto& ex : log) {
            if (ex && ex->getDate() == date) {
                total += ex->getCalories();
            }
        }
        return total;
    }

    int minutesOn(const std::string& date) const {
        int total = 0;
        for (const auto& ex : log) {
            if (ex && ex->getDate() == date) {
                total += ex->getDurationMin();
            }
        }
        return total;
    }

    int streak() const {
        std::string today = DateHelper::getFormattedDate(0);
        int offset = 0;

        if (caloriesOn(today) > 0 || minutesOn(today) > 0) {
            offset = 0;
        } else {
            std::string yesterday = DateHelper::getFormattedDate(-1);
            if (caloriesOn(yesterday) > 0 || minutesOn(yesterday) > 0) {
                offset = -1;
            } else {
                return 0;
            }
        }

        int count = 0;
        while (true) {
            std::string d = DateHelper::getFormattedDate(offset);
            if (caloriesOn(d) > 0 || minutesOn(d) > 0) {
                count++;
                offset--;
                if (count > 365) break;
            } else {
                break;
            }
        }
        return count;
    }

    nlohmann::json weekSummary() const {
        nlohmann::json week = nlohmann::json::array();
        for (int offset = -6; offset <= 0; ++offset) {
            std::string d = DateHelper::getFormattedDate(offset);
            std::string dayName = DateHelper::getDayAbbr(offset);
            double cal = caloriesOn(d);
            week.push_back({
                {"day", dayName},
                {"calories", cal},
                {"date", d},
                {"isToday", (offset == 0)}
            });
        }
        return week;
    }

    nlohmann::json todayExercises() const {
        std::string today = DateHelper::getFormattedDate(0);
        nlohmann::json list = nlohmann::json::array();
        for (const auto& ex : log) {
            if (ex && ex->getDate() == today) {
                list.push_back(ex->toJson());
            }
        }
        return list;
    }

    nlohmann::json toJson() const {
        nlohmann::json logArr = nlohmann::json::array();
        for (const auto& ex : log) {
            if (ex) logArr.push_back(ex->toJson());
        }

        nlohmann::json planArr = nlohmann::json::array();
        for (const auto& p : plans) {
            planArr.push_back(p.toJson());
        }

        return {
            {"username", username},
            {"salt", salt},
            {"passwordHash", passwordHash},
            {"weightKg", weightKg},
            {"dailyGoal", dailyGoal},
            {"log", logArr},
            {"plans", planArr}
        };
    }

    static User fromJson(const nlohmann::json& j) {
        User user(
            j.value("username", ""),
            j.value("salt", ""),
            j.value("passwordHash", ""),
            j.value("weightKg", 70.0),
            j.value("dailyGoal", 500.0)
        );

        if (j.contains("log") && j["log"].is_array()) {
            for (const auto& item : j["log"]) {
                user.logExercise(Exercise::fromJson(item));
            }
        }

        if (j.contains("plans") && j["plans"].is_array()) {
            for (const auto& item : j["plans"]) {
                user.addPlan(WorkoutPlan::fromJson(item));
            }
        }

        return user;
    }
};
