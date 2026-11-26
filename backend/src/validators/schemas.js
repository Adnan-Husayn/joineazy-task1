const { z } = require('zod');

const registerSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(120),
    email: z.string().trim().email('Please provide a valid email address').max(255),
    password: z
      .string()
      .min(6, 'Password must be at least 6 characters')
      .max(128, 'Password cannot exceed 128 characters'),
    role: z.enum(['student', 'admin']).optional().default('student'),
    studentId: z.string().trim().max(50).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.role === 'student' && (!data.studentId || data.studentId.trim().length < 2)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['studentId'],
        message: 'Student ID is required for student registration',
      });
    }
  });

const loginSchema = z.object({
  email: z.string().trim().email('Please provide a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

const createGroupSchema = z.object({
  name: z.string().trim().min(2, 'Group name must be at least 2 characters').max(120),
  description: z.string().trim().max(500).optional().default(''),
  memberIdentifiers: z.array(z.string().trim().min(1)).max(25).optional().default([]),
});

const addMemberSchema = z.object({
  identifier: z.string().trim().min(2, 'Enter a student email or student ID'),
});

const createCourseSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, 'Course code must be at least 2 characters')
    .max(30, 'Course code cannot exceed 30 characters'),
  title: z
    .string()
    .trim()
    .min(3, 'Course title must be at least 3 characters')
    .max(160, 'Course title cannot exceed 160 characters'),
  description: z.string().trim().max(2000).optional().default(''),
  semester: z.string().trim().min(2).max(60).optional().default('Fall 2026'),
  accentColor: z
    .enum(['indigo', 'emerald', 'amber', 'violet', 'sky', 'rose'])
    .optional()
    .default('indigo'),
  enrollAllStudents: z.boolean().optional().default(true),
  studentIds: z.array(z.number().int().positive()).optional().default([]),
});

const enrollStudentSchema = z
  .object({
    identifier: z.string().trim().min(1).optional(),
    email: z.string().trim().email('Please provide a valid student email').optional(),
    studentId: z
      .union([z.number().int().positive(), z.string().trim().min(1)])
      .optional(),
  })
  .refine((data) => Boolean(data.identifier || data.email || data.studentId), {
    message: 'Provide a student email or Student ID to enroll',
  });

const assignmentSchema = z
  .object({
    courseId: z.number().int().positive('Valid course ID is required').nullable().optional(),
    title: z.string().trim().min(3, 'Title must be at least 3 characters').max(200),
    description: z.string().trim().max(4000).optional().default(''),
    dueDate: z
      .string()
      .trim()
      .refine((val) => !Number.isNaN(Date.parse(val)), 'Please enter a valid due date'),
    onedriveLink: z
      .string()
      .trim()
      .url('Please enter a valid URL')
      .refine(
        (val) => val.startsWith('https://') || val.startsWith('http://'),
        'OneDrive link must start with http:// or https://'
      ),
    submissionType: z.enum(['individual', 'group']).optional().default('group'),
    targetType: z.enum(['all', 'specific_groups']).default('all'),
    targetGroupIds: z.array(z.number().int().positive()).optional().default([]),
  })
  .superRefine((data, ctx) => {
    if (data.submissionType === 'individual' && data.targetType === 'specific_groups') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['targetType'],
        message: 'Individual assignments must apply to all enrolled students',
      });
    }
    if (data.targetType === 'specific_groups' && data.targetGroupIds.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['targetGroupIds'],
        message: 'Select at least one group when assigning to specific groups',
      });
    }
  });

const confirmSubmissionSchema = z.object({
  assignmentId: z.number().int().positive('Valid assignment ID is required'),
  groupId: z.number().int().positive().nullable().optional(),
  note: z.string().trim().max(500, 'Note cannot exceed 500 characters').optional().default(''),
  confirmedUpload: z.literal(true, {
    errorMap: () => ({
      message: 'Please confirm that you have uploaded your work to OneDrive before submitting',
    }),
  }),
});

module.exports = {
  registerSchema,
  loginSchema,
  createGroupSchema,
  addMemberSchema,
  createCourseSchema,
  enrollStudentSchema,
  assignmentSchema,
  confirmSubmissionSchema,
};
