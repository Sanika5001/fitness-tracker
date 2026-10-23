#pragma once

#include <string>
#include <vector>
#include <memory>
#include "Exercise.h"
#include "third_party/json.hpp"

class WorkoutPlan {
private:
    std::string planName;
    std::vector<std::shared_ptr<Exercise>> exercises;

public:
    WorkoutPlan() = default;
    explicit WorkoutPlan(std::string name) : planName(std::move(name)) {}

    const std::string& getPlanName() const { return planName; }
    const std::vector<std::shared_ptr<Exercise>>& getExercises() const { return exercises; }

    void addExercise(std::shared_ptr<Exercise> ex) {
        if (ex) {
            exercises.push_back(std::move(ex));
        }
    }

    bool removeExercise(size_t index) {
        if (index < exercises.size()) {
            exercises.erase(exercises.begin() + index);
            return true;
        }
        return false;
    }

    int totalDuration() const {
        int total = 0;
        for (const auto& ex : exercises) {
            if (ex) total += ex->getDurationMin();
        }
        return total;
    }

    double totalCalories() const {
        double total = 0.0;
        for (const auto& ex : exercises) {
            if (ex) total += ex->getCalories();
        }
        return total;
    }

    nlohmann::json toJson() const {
        nlohmann::json exList = nlohmann::json::array();
        for (const auto& ex : exercises) {
            if (ex) exList.push_back(ex->toJson());
        }
        return {
            {"planName", planName},
            {"totalDuration", totalDuration()},
            {"totalCalories", totalCalories()},
            {"exercises", exList}
        };
    }

    static WorkoutPlan fromJson(const nlohmann::json& j) {
        WorkoutPlan plan(j.value("planName", "Unnamed Plan"));
        if (j.contains("exercises") && j["exercises"].is_array()) {
            for (const auto& item : j["exercises"]) {
                plan.addExercise(Exercise::fromJson(item));
            }
        }
        return plan;
    }
};
