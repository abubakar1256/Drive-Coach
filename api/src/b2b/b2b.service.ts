import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma.service";
import { CreateSchoolDto, InviteStudentDto } from "./dto/b2b.dto";

@Injectable()
export class B2bService {
  constructor(private readonly prisma: PrismaService) {}

  async createSchool(userId: string, dto: CreateSchoolDto) {
    const schoolId = randomUUID(); const instructorId = randomUUID();
    try {
      const school = await this.prisma.$queryRawUnsafe<Array<{ id: string; name: string; slug: string }>>('INSERT INTO "DrivingSchool" ("id", "name", "slug", "email", "createdByUserId") VALUES ($1,$2,$3,$4,$5) RETURNING "id", "name", "slug"', schoolId, dto.name.trim(), dto.slug.trim().toLowerCase(), dto.email?.trim().toLowerCase() ?? null, userId);
      await this.prisma.$executeRawUnsafe('INSERT INTO "InstructorProfile" ("id", "userId", "schoolId") VALUES ($1,$2,$3)', instructorId, userId, schoolId);
      return { ...school[0], instructorId };
    } catch (error) { throw new ConflictException("School slug or instructor profile already exists"); }
  }

  async me(userId: string) {
    const instructors = await this.prisma.$queryRawUnsafe<Array<{ id: string; schoolId: string; status: string; schoolName: string; schoolSlug: string }>>('SELECT i."id", i."schoolId", i."status", s."name" AS "schoolName", s."slug" AS "schoolSlug" FROM "InstructorProfile" i JOIN "DrivingSchool" s ON s."id" = i."schoolId" WHERE i."userId" = $1', userId);
    const enrollments = instructors[0] ? await this.prisma.$queryRawUnsafe('SELECT e."id", e."status", e."invitedAt", e."joinedAt", u."email" AS "studentEmail", u."displayName" AS "studentName" FROM "StudentEnrollment" e JOIN "InstructorProfile" i ON i."id" = e."instructorId" JOIN "User" u ON u."id" = e."studentId" WHERE i."userId" = $1 ORDER BY e."createdAt" DESC', userId) : [];
    const studentEnrollments = await this.prisma.$queryRawUnsafe('SELECT e."id", e."status", e."invitedAt", e."joinedAt", s."name" AS "schoolName", s."slug" AS "schoolSlug", u."email" AS "instructorEmail", u."displayName" AS "instructorName" FROM "StudentEnrollment" e JOIN "InstructorProfile" i ON i."id" = e."instructorId" JOIN "DrivingSchool" s ON s."id" = i."schoolId" JOIN "User" u ON u."id" = i."userId" WHERE e."studentId" = $1 ORDER BY e."createdAt" DESC', userId);
    return { instructor: instructors[0] ?? null, enrollments, studentEnrollments };
  }

  async invite(userId: string, dto: InviteStudentDto) {
    const instructor = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>('SELECT "id" FROM "InstructorProfile" WHERE "userId" = $1 AND "status" = \'ACTIVE\'', userId);
    if (!instructor[0]) throw new NotFoundException("Create an instructor profile first");
    const student = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>('SELECT "id" FROM "User" WHERE "email" = $1', dto.studentEmail.trim().toLowerCase());
    if (!student[0]) throw new NotFoundException("Student account not found");
    if (student[0].id === userId) throw new ConflictException("You cannot enrol yourself");
    const rows = await this.prisma.$queryRawUnsafe<Array<{ id: string; status: string }>>('INSERT INTO "StudentEnrollment" ("id", "instructorId", "studentId", "status") VALUES ($1,$2,$3,\'INVITED\') ON CONFLICT ("instructorId", "studentId") DO UPDATE SET "status" = \'INVITED\', "invitedAt" = NOW() RETURNING "id", "status"', randomUUID(), instructor[0].id, student[0].id);
    return { success: true, enrollment: rows[0] };
  }

  async accept(userId: string, enrollmentId: string) {
    const result = await this.prisma.$executeRawUnsafe('UPDATE "StudentEnrollment" SET "status" = \'ACTIVE\', "joinedAt" = COALESCE("joinedAt", NOW()) WHERE "id" = $1 AND "studentId" = $2', enrollmentId, userId);
    if (!result) throw new NotFoundException("Enrollment not found");
    return { success: true, enrollmentId };
  }
}
