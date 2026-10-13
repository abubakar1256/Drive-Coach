import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma.service";
import { AssignRouteDto, CreateSchoolDto, InstructorFeedbackDto, InviteStudentDto } from "./dto/b2b.dto";

@Injectable()
export class B2bService {
  constructor(private readonly prisma: PrismaService) {}

  private async enrollmentForInstructor(userId: string, enrollmentId: string) {
    const enrollment = await this.prisma.studentEnrollment.findFirst({ where: { id: enrollmentId, status: "ACTIVE", instructor: { userId, status: "ACTIVE" } } });
    if (!enrollment) throw new ForbiddenException("Active instructor/student enrollment required");
    return enrollment;
  }
  async assign(userId: string, enrollmentId: string, dto: AssignRouteDto) {
    const enrollment = await this.enrollmentForInstructor(userId, enrollmentId);
    const route = await this.prisma.route.findFirst({ where: { id: dto.routeId, status: "PUBLISHED", verificationStatus: { in: ["VERIFIED", "ROAD_VALIDATED"] }, reviewedBy: { not: null }, centre: { isPublished: true } } });
    if (!route) throw new NotFoundException("Reviewed route not found");
    return this.prisma.$transaction(async tx => {
      const assignment = await tx.routeAssignment.upsert({ where: { enrollmentId_routeId: { enrollmentId, routeId: dto.routeId } }, create: { enrollmentId, routeId: dto.routeId, notes: dto.notes, dueAt: dto.dueAt ? new Date(dto.dueAt) : null }, update: { notes: dto.notes, dueAt: dto.dueAt ? new Date(dto.dueAt) : null, completedAt: null } });
      await tx.notification.create({ data: { userId: enrollment.studentId, type: "ROUTE_ASSIGNED", title: "Your instructor assigned a route", body: `${route.name}: ${dto.notes ?? "Review the route before practice."}`, metadata: { routeSlug: route.slug } } });
      return assignment;
    });
  }
  async assignments(userId: string) {
    return this.prisma.routeAssignment.findMany({ where: { enrollment: { status: "ACTIVE", OR: [{ studentId: userId }, { instructor: { userId, status: "ACTIVE" } }] } }, include: { route: { select: { id: true, slug: true, name: true, status: true, centre: { select: { name: true } } } }, enrollment: { select: { id: true, studentId: true, student: { select: { displayName: true } } } } }, orderBy: { createdAt: "desc" } });
  }
  async studentHistory(userId: string, enrollmentId: string) {
    const enrollment = await this.enrollmentForInstructor(userId, enrollmentId);
    return this.prisma.practiceSession.findMany({ where: { userId: enrollment.studentId }, include: { reflection: true, route: { select: { id: true, name: true, slug: true } }, instructorFeedback: { where: { enrollmentId } } }, orderBy: { startedAt: "desc" }, take: 50 });
  }
  async feedback(userId: string, enrollmentId: string, dto: InstructorFeedbackDto) {
    const enrollment = await this.enrollmentForInstructor(userId, enrollmentId);
    const session = await this.prisma.practiceSession.findFirst({ where: { id: dto.sessionId, userId: enrollment.studentId } });
    if (!session) throw new NotFoundException("Student practice session not found");
    return this.prisma.$transaction(async tx => {
      const feedback = await tx.instructorFeedback.upsert({ where: { enrollmentId_sessionId: { enrollmentId, sessionId: dto.sessionId } }, create: { enrollmentId, sessionId: dto.sessionId, body: dto.body.trim() }, update: { body: dto.body.trim() } });
      await tx.notification.create({ data: { userId: enrollment.studentId, type: "INSTRUCTOR_FEEDBACK", title: "Instructor feedback received", body: dto.body.trim(), metadata: { sessionId: session.id } } });
      return feedback;
    });
  }
  async myFeedback(userId: string) {
    return this.prisma.instructorFeedback.findMany({ where: { enrollment: { studentId: userId, status: "ACTIVE" } }, include: { session: { select: { route: { select: { name: true } } } }, enrollment: { select: { instructor: { select: { user: { select: { displayName: true } } } } } } }, orderBy: { updatedAt: "desc" }, take: 50 });
  }
  async inviteInstructor(userId: string, schoolId: string, email: string) {
    const school = await this.prisma.drivingSchool.findFirst({ where: { id: schoolId, createdByUserId: userId } });
    if (!school) throw new ForbiddenException("School owner required");
    const user = await this.prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!user) throw new NotFoundException("Instructor must register first");
    if (await this.prisma.instructorProfile.findUnique({ where: { userId: user.id } })) throw new ConflictException("Instructor already belongs to a school");
    return this.prisma.$transaction(async tx => {
      const profile = await tx.instructorProfile.create({ data: { userId: user.id, schoolId, status: "INVITED" } });
      await tx.notification.create({ data: { userId: user.id, type: "INSTRUCTOR_INVITE", title: "Driving-school invitation", body: `${school.name} invited you as an instructor. Accept from your dashboard.` } });
      return profile;
    });
  }
  async acceptInstructor(userId: string) {
    const result = await this.prisma.instructorProfile.updateMany({ where: { userId, status: "INVITED" }, data: { status: "ACTIVE" } });
    if (!result.count) throw new NotFoundException("Instructor invitation not found");
    return { success: true };
  }
  async revokeEnrollment(userId: string, id: string) {
    const changed = await this.prisma.studentEnrollment.updateMany({ where: { id, OR: [{ studentId: userId }, { instructor: { userId, status: "ACTIVE" } }] }, data: { status: "REVOKED" } });
    if (!changed.count) throw new ForbiddenException("Enrollment permission required");
    return { success: true };
  }
  async removeInstructor(userId: string, schoolId: string, id: string) {
    if (!await this.prisma.drivingSchool.findFirst({ where: { id: schoolId, createdByUserId: userId } })) throw new ForbiddenException("School owner required");
    const instructor = await this.prisma.instructorProfile.findFirst({ where: { id, schoolId, userId: { not: userId } } });
    if (!instructor) throw new NotFoundException("Other school instructor not found");
    return this.prisma.$transaction(async tx => {
      await tx.instructorProfile.update({ where: { id }, data: { status: "INACTIVE" } });
      await tx.studentEnrollment.updateMany({ where: { instructorId: id }, data: { status: "REVOKED" } });
      await tx.auditLog.create({ data: { userId, action: "INSTRUCTOR_REMOVED", entity: "InstructorProfile", entityId: id } });
      return { success: true };
    });
  }
  async schoolBilling(userId: string, schoolId: string) {
    if (!await this.prisma.drivingSchool.findFirst({ where: { id: schoolId, createdByUserId: userId } })) throw new ForbiddenException("School owner required");
    return this.prisma.payment.findMany({ where: { schoolId }, select: { id: true, amountCents: true, currency: true, status: true, createdAt: true, plan: { select: { name: true } }, invoices: true }, orderBy: { createdAt: "desc" }, take: 100 });
  }

  async createSchool(userId: string, dto: CreateSchoolDto) {
    if (await this.prisma.instructorProfile.findUnique({ where: { userId } })) throw new ConflictException("Account already belongs to a school");
    return this.prisma.$transaction(async tx => {
      const school = await tx.drivingSchool.create({ data: { name: dto.name.trim(), slug: dto.slug.trim().toLowerCase(), email: dto.email?.trim().toLowerCase(), createdByUserId: userId } });
      const instructor = await tx.instructorProfile.create({ data: { userId, schoolId: school.id } });
      return { ...school, instructorId: instructor.id };
    });
  }

  async me(userId: string) {
    const instructors = await this.prisma.$queryRawUnsafe<Array<{ id: string; schoolId: string; status: string; schoolName: string; schoolSlug: string }>>('SELECT i."id", i."schoolId", i."status", s."name" AS "schoolName", s."slug" AS "schoolSlug" FROM "InstructorProfile" i JOIN "DrivingSchool" s ON s."id" = i."schoolId" WHERE i."userId" = $1', userId);
    const enrollments = instructors[0] ? await this.prisma.$queryRawUnsafe('SELECT e."id", e."status", e."invitedAt", e."joinedAt", u."email" AS "studentEmail", u."displayName" AS "studentName" FROM "StudentEnrollment" e JOIN "InstructorProfile" i ON i."id" = e."instructorId" JOIN "User" u ON u."id" = e."studentId" WHERE i."userId" = $1 ORDER BY e."createdAt" DESC', userId) : [];
    const studentEnrollments = await this.prisma.$queryRawUnsafe('SELECT e."id", e."status", e."invitedAt", e."joinedAt", s."name" AS "schoolName", s."slug" AS "schoolSlug", u."email" AS "instructorEmail", u."displayName" AS "instructorName" FROM "StudentEnrollment" e JOIN "InstructorProfile" i ON i."id" = e."instructorId" JOIN "DrivingSchool" s ON s."id" = i."schoolId" JOIN "User" u ON u."id" = i."userId" WHERE e."studentId" = $1 ORDER BY e."createdAt" DESC', userId);
    const ownedSchool = await this.prisma.drivingSchool.findFirst({ where: { createdByUserId: userId }, include: { instructors: { include: { user: { select: { displayName: true, email: true } } } } } });
    return { instructor: instructors[0] ?? null, enrollments, studentEnrollments, ownedSchool };
  }

  async invite(userId: string, dto: InviteStudentDto) {
    const instructor = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>('SELECT "id" FROM "InstructorProfile" WHERE "userId" = $1 AND "status" = \'ACTIVE\'', userId);
    if (!instructor[0]) throw new NotFoundException("Create an instructor profile first");
    const student = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>('SELECT "id" FROM "User" WHERE "email" = $1', dto.studentEmail.trim().toLowerCase());
    if (!student[0]) throw new NotFoundException("Student account not found");
    if (student[0].id === userId) throw new ConflictException("You cannot enrol yourself");
    return this.prisma.$transaction(async tx => {
      const enrollment = await tx.studentEnrollment.upsert({
        where: { instructorId_studentId: { instructorId: instructor[0].id, studentId: student[0].id } },
        create: { instructorId: instructor[0].id, studentId: student[0].id, status: "INVITED" },
        update: {},
      });
      if (enrollment.status === "REVOKED") throw new ConflictException("Student revoked this enrollment; do not silently restore it");
      if (enrollment.status === "INVITED") await tx.notification.create({ data: { userId: student[0].id, type: "STUDENT_INVITE", title: "Instructor invitation", body: "An instructor invited you to share your practice progress. Accept from your dashboard.", metadata: { enrollmentId: enrollment.id } } });
      return { success: true, enrollment };
    });
  }

  async accept(userId: string, enrollmentId: string) {
    const result = await this.prisma.studentEnrollment.updateMany({
      where: { id: enrollmentId, studentId: userId, status: "INVITED", instructor: { status: "ACTIVE" } },
      data: { status: "ACTIVE", joinedAt: new Date() },
    });
    if (!result.count) throw new NotFoundException("Active instructor invitation not found");
    return { success: true, enrollmentId };
  }
}
