// Local UI fixtures only. Never run as a production API.
const http = require("node:http");
const { JwtService } = require("@nestjs/jwt");
const jwt = new JwtService({ secret: "local-platform-ui-fixture" });
const user = { id: "qa-admin", email: "admin@example.test", displayName: "QA Admin", role: "ADMIN", emailVerified: true, subscription: { status: "ACTIVE", planName: "Diamond" } };
const centre = { id: "centre-a", slug: "alken", name: "Alken", city: "Alken", area: "Alken", region: "Limburg", isPublished: true, latitude: 50.88597, longitude: 5.2983, _count: { routes: 1 } };
const points = [[5.2983, 50.88597], [5.31, 50.90], [5.33, 50.895], [5.315, 50.875], [5.2983, 50.88597]].map(([longitude, latitude], i) => ({ id: `point-${i}`, sequence: i + 1, title: `Practice waypoint ${i + 1}`, category: i ? "waypoint" : "start", description: "UI fixture road point", warning: null, latitude, longitude, imageUrl: null, videoUrl: null }));
const route = { id: "route-a", slug: "alken-ui-fixture", name: "Fixture practice loop", status: "PUBLISHED", verificationStatus: "VERIFIED", sourceLabel: "Fixture instructor review", durationMin: 30, centre, points, access: { premium: true, preview: false }, driving: { valid: true, issues: [], durationSec: 1800, distanceM: 14000, coordinates: points.map(p => [p.longitude, p.latitude]) } };
const school = { id: "school-a", createdByUserId: user.id, name: "Fixture school", instructors: [{ id: "instructor-a", userId: user.id, status: "ACTIVE", user: { email: user.email } }] };
let preferences = { remindersEnabled: false, examDate: null, practiceReminderAt: null };
const server = http.createServer(async (req, res) => {
  let body = ""; for await (const chunk of req) body += chunk;
  let data = {}; try { data = JSON.parse(body || "{}"); } catch {}
  const path = new URL(req.url, "http://127.0.0.1").pathname.replace(/^\/api\/v1/, "");
  let payload = { success: true };
  if (path === "/auth/login" || path === "/auth/refresh") payload = { user, accessToken: jwt.sign({ sub: user.id, email: user.email, role: user.role }, { expiresIn: "15m" }), refreshToken: "fixture-refresh", expiresIn: 900 };
  else if (path === "/auth/me") payload = user;
  else if (path === "/exam-centres" || path === "/admin/centres") payload = [centre];
  else if (path === "/routes" || path === "/admin/routes") payload = [route];
  else if (path.startsWith("/routes/")) payload = route;
  else if (path === "/plans") payload = [{ id: "premium-plan", name: "Premium", durationHours: 2160, priceCents: 1499, currency: "EUR" }, { id: "diamond-plan", name: "Diamond", durationHours: 2160, priceCents: 1999, currency: "EUR" }];
  else if (path === "/me/subscription") payload = { plan: "Diamond", status: "ACTIVE", centreId: null };
  else if (path === "/me/entitlements") payload = { plan: "Diamond", status: "ACTIVE", features: { aiChat: true } };
  else if (path === "/me/payments" || path === "/me/invoices" || path === "/me/favorites") payload = [];
  else if (path === "/me/dashboard") payload = { user, subscription: { plan: "Diamond", status: "ACTIVE" }, stats: { favoriteCount: 0, sessionCount: 1, completedSessions: 0, averageProgress: 25 }, favorites: [], sessions: [], recommendations: [{ skill: "Preparation", message: "Review your assigned route." }] };
  else if (path === "/b2b/me") payload = { instructor: { status: "ACTIVE", schoolId: school.id, schoolName: school.name }, enrollments: [{ id: "enrollment-a", status: "ACTIVE", studentEmail: "learner@example.test" }], studentEnrollments: [], ownedSchool: school };
  else if (path === "/b2b/assignments") payload = [{ id: "assignment-a", route, notes: "Review the route", dueAt: null, completedAt: null, enrollment: { student: { displayName: "Fixture learner" } } }];
  else if (path === "/b2b/feedback") payload = [];
  else if (path.endsWith("/history")) payload = [{ id: "session-a", completionPct: 25, durationSec: 600, completionKind: "ENDED", route, reflection: { overallFeeling: "okay", instructorNotes: "Practice observation" } }];
  else if (path.endsWith("/billing")) payload = [];
  else if (path === "/me/referrals") payload = [];
  else if (path.endsWith("/current")) payload = { code: "QA-202610-ABC" };
  else if (path === "/me/notifications/preferences") { if (req.method === "POST") preferences = data; payload = preferences; }
  else if (path === "/me/notifications") payload = [];
  else if (path === "/admin/reports/overview") payload = { users: 2, publishedCentres: 1, routes: 1, publishedRoutes: 1, subscriptions: [], practice: { sessions: 1, averageCompletion: 25, reflections: 1 }, analytics: { pageViews: 1, centreViews: 1, routeViews: 1, revenue: [], failedPayments: 0, popularCentres: [], popularRoutes: [] } };
  else if (["/admin/users", "/admin/payments", "/admin/audit-logs", "/admin/commissions"].includes(path) || path.endsWith("/official-passage-points")) payload = [];
  else if (path === "/admin/routes/route-a" && req.method === "PATCH") { Object.assign(route, data); payload = route; }
  else if (path.endsWith("/driving-check")) payload = route.driving;
  else if (path === "/admin/notifications") payload = { recipients: 2 };
  else if (path === "/practice-sessions") payload = { id: "session-a", completionPct: 0 };
  else if (path.endsWith("/track")) payload = { accepted: true, completionPct: 25 };
  else if (path === "/practice-sessions/session-a") payload = { completionPct: 25, durationSec: 600, completionKind: "ENDED" };
  res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(payload));
});
server.listen(4610, "127.0.0.1", () => process.stdout.write("Local UI fixture API: http://127.0.0.1:4610\n"));
