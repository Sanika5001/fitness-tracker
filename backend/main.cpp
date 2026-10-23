#include <iostream>
#include <cstdlib>
#include <string>
#include <memory>
#include <sstream>
#include <algorithm>

#include "third_party/httplib.h"
#include "third_party/json.hpp"
#include "Exercise.h"
#include "WorkoutPlan.h"
#include "User.h"
#include "UserManager.h"
#include "Session.h"
#include "Seed.h"

static std::string urlDecode(const std::string& in) {
    std::string out;
    out.reserve(in.size());
    for (size_t i = 0; i < in.size(); ++i) {
        if (in[i] == '%' && i + 2 < in.size()) {
            int val = 0;
            std::istringstream is(in.substr(i + 1, 2));
            if (is >> std::hex >> val) {
                out += static_cast<char>(val);
                i += 2;
                continue;
            }
        }
        if (in[i] == '+') out += ' ';
        else out += in[i];
    }
    return out;
}

static bool authUser(const httplib::Request& req, httplib::Response& res,
                     Session& session, std::string& username) {
    if (!req.has_header("Authorization")) {
        res.status = 401;
        res.set_content(R"({"error":"Missing authorization header"})", "application/json");
        return false;
    }
    std::string auth = req.get_header_value("Authorization");
    if (auth.rfind("Bearer ", 0) != 0) {
        res.status = 401;
        res.set_content(R"({"error":"Invalid token format"})", "application/json");
        return false;
    }
    std::string token = auth.substr(7);
    username = session.userFor(token);
    if (username.empty()) {
        res.status = 401;
        res.set_content(R"({"error":"Unauthorized or expired session"})", "application/json");
        return false;
    }
    return true;
}

int main() {
    httplib::Server svr;
    UserManager userMgr;
    seedDemo(userMgr);
    Session session;

    svr.Get("/", [](const httplib::Request&, httplib::Response& res) {
        res.set_redirect("/login.html");
    });

    svr.Post("/api/register", [&](const httplib::Request& req, httplib::Response& res) {
        try {
            auto body = nlohmann::json::parse(req.body);
            std::string username = body.value("username", "");
            std::string password = body.value("password", "");
            double weight = body.value("weight", 0.0);

            std::string errorMsg;
            if (userMgr.registerUser(username, password, weight, errorMsg)) {
                res.status = 201;
                res.set_content(R"({"message":"Account created successfully"})", "application/json");
            } else {
                res.status = 400;
                res.set_content(nlohmann::json{{"error", errorMsg}}.dump(), "application/json");
            }
        } catch (const std::exception&) {
            res.status = 400;
            res.set_content(R"({"error":"Invalid JSON payload"})", "application/json");
        }
    });

    svr.Post("/api/login", [&](const httplib::Request& req, httplib::Response& res) {
        try {
            auto body = nlohmann::json::parse(req.body);
            std::string username = body.value("username", "");
            std::string password = body.value("password", "");

            if (userMgr.verify(username, password)) {
                std::string token = session.create(username);
                res.status = 200;
                res.set_content(nlohmann::json{{"token", token}}.dump(), "application/json");
            } else {
                res.status = 401;
                res.set_content(R"({"error":"Invalid username or password"})", "application/json");
            }
        } catch (const std::exception&) {
            res.status = 400;
            res.set_content(R"({"error":"Invalid JSON payload"})", "application/json");
        }
    });

    svr.Post("/api/logout", [&](const httplib::Request& req, httplib::Response& res) {
        std::string username;
        if (!authUser(req, res, session, username)) return;

        std::string token = req.get_header_value("Authorization").substr(7);
        session.remove(token);
        res.status = 200;
        res.set_content(R"({"ok":true})", "application/json");
    });

    svr.Get("/api/me", [&](const httplib::Request& req, httplib::Response& res) {
        std::string username;
        if (!authUser(req, res, session, username)) return;

        User u;
        if (userMgr.getUser(username, u)) {
            res.status = 200;
            res.set_content(nlohmann::json{
                {"username", u.getUsername()},
                {"weight", u.getWeightKg()},
                {"dailyGoal", u.getDailyGoal()}
            }.dump(), "application/json");
        } else {
            res.status = 404;
            res.set_content(R"({"error":"User not found"})", "application/json");
        }
    });

    svr.Put("/api/me", [&](const httplib::Request& req, httplib::Response& res) {
        std::string username;
        if (!authUser(req, res, session, username)) return;

        try {
            auto body = nlohmann::json::parse(req.body);
            User u;
            if (!userMgr.getUser(username, u)) {
                res.status = 404;
                res.set_content(R"({"error":"User not found"})", "application/json");
                return;
            }

            double weight = body.value("weight", u.getWeightKg());
            double dailyGoal = body.value("dailyGoal", u.getDailyGoal());

            std::string errMsg;
            if (userMgr.updateProfile(username, weight, dailyGoal, errMsg)) {
                res.status = 200;
                res.set_content(nlohmann::json{
                    {"username", username},
                    {"weight", weight},
                    {"dailyGoal", dailyGoal}
                }.dump(), "application/json");
            } else {
                res.status = 400;
                res.set_content(nlohmann::json{{"error", errMsg}}.dump(), "application/json");
            }
        } catch (const std::exception&) {
            res.status = 400;
            res.set_content(R"({"error":"Invalid JSON payload"})", "application/json");
        }
    });

    svr.Get("/api/summary", [&](const httplib::Request& req, httplib::Response& res) {
        std::string username;
        if (!authUser(req, res, session, username)) return;

        User u;
        if (userMgr.getUser(username, u)) {
            std::string today = DateHelper::getFormattedDate(0);
            nlohmann::json summary = {
                {"todayCalories", u.caloriesOn(today)},
                {"todayMinutes", u.minutesOn(today)},
                {"goal", u.getDailyGoal()},
                {"streak", u.streak()},
                {"week", u.weekSummary()},
                {"today", u.todayExercises()}
            };
            res.status = 200;
            res.set_content(summary.dump(), "application/json");
        } else {
            res.status = 404;
            res.set_content(R"({"error":"User not found"})", "application/json");
        }
    });

    svr.Get("/api/exercises", [&](const httplib::Request& req, httplib::Response& res) {
        std::string username;
        if (!authUser(req, res, session, username)) return;

        User u;
        if (userMgr.getUser(username, u)) {
            nlohmann::json list = nlohmann::json::array();
            const auto& log = u.getLog();
            for (auto it = log.rbegin(); it != log.rend(); ++it) {
                if (*it) {
                    list.push_back((*it)->toJson());
                }
            }
            res.status = 200;
            res.set_content(list.dump(), "application/json");
        } else {
            res.status = 404;
            res.set_content(R"({"error":"User not found"})", "application/json");
        }
    });

    svr.Post("/api/exercises", [&](const httplib::Request& req, httplib::Response& res) {
        std::string username;
        if (!authUser(req, res, session, username)) return;

        try {
            auto body = nlohmann::json::parse(req.body);
            body["date"] = DateHelper::getFormattedDate(0);
            auto ex = Exercise::fromJson(body);

            std::shared_ptr<Exercise> loggedEx;
            if (userMgr.logExercise(username, ex, loggedEx) && loggedEx) {
                res.status = 201;
                res.set_content(loggedEx->toJson().dump(), "application/json");
            } else {
                res.status = 400;
                res.set_content(R"({"error":"Failed to log exercise"})", "application/json");
            }
        } catch (const std::exception&) {
            res.status = 400;
            res.set_content(R"({"error":"Invalid exercise data"})", "application/json");
        }
    });

    svr.Get("/api/plans", [&](const httplib::Request& req, httplib::Response& res) {
        std::string username;
        if (!authUser(req, res, session, username)) return;

        User u;
        if (userMgr.getUser(username, u)) {
            nlohmann::json list = nlohmann::json::array();
            for (const auto& plan : u.getPlans()) {
                list.push_back(plan.toJson());
            }
            res.status = 200;
            res.set_content(list.dump(), "application/json");
        } else {
            res.status = 404;
            res.set_content(R"({"error":"User not found"})", "application/json");
        }
    });

    svr.Post("/api/plans", [&](const httplib::Request& req, httplib::Response& res) {
        std::string username;
        if (!authUser(req, res, session, username)) return;

        try {
            auto body = nlohmann::json::parse(req.body);
            std::string planName = body.value("planName", "");
            if (planName.empty()) {
                res.status = 400;
                res.set_content(R"({"error":"Plan name cannot be empty"})", "application/json");
                return;
            }

            WorkoutPlan plan(planName);
            std::string errMsg;
            if (userMgr.addPlan(username, plan, errMsg)) {
                res.status = 201;
                res.set_content(plan.toJson().dump(), "application/json");
            } else {
                res.status = 400;
                res.set_content(nlohmann::json{{"error", errMsg}}.dump(), "application/json");
            }
        } catch (const std::exception&) {
            res.status = 400;
            res.set_content(R"({"error":"Invalid plan data"})", "application/json");
        }
    });

    svr.Post(R"(/api/plans/([^/]+)/exercises)", [&](const httplib::Request& req, httplib::Response& res) {
        std::string username;
        if (!authUser(req, res, session, username)) return;

        try {
            std::string planName = urlDecode(req.matches[1]);
            auto body = nlohmann::json::parse(req.body);
            body["date"] = DateHelper::getFormattedDate(0);
            auto ex = Exercise::fromJson(body);

            WorkoutPlan updatedPlan;
            std::string errMsg;
            if (userMgr.addExerciseToPlan(username, planName, ex, updatedPlan, errMsg)) {
                res.status = 200;
                res.set_content(updatedPlan.toJson().dump(), "application/json");
            } else {
                res.status = 400;
                res.set_content(nlohmann::json{{"error", errMsg}}.dump(), "application/json");
            }
        } catch (const std::exception&) {
            res.status = 400;
            res.set_content(R"({"error":"Invalid exercise data"})", "application/json");
        }
    });

    svr.set_mount_point("/", "./frontend");

    const char* portEnv = std::getenv("PORT");
    int port = portEnv ? std::atoi(portEnv) : 8080;
    std::cout << "FitTrack server listening on 0.0.0.0:" << port << std::endl;
    svr.listen("0.0.0.0", port);

    return 0;
}
