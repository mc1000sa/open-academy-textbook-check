import { describe, expect, it } from 'vitest';
import { COLLECTION_NAMES } from './firebaseService.js';

describe('firebaseService', () => {
  it('keeps the existing Firestore collection names stable', () => {
    expect(COLLECTION_NAMES).toEqual({
      teachers: 'openacademy_textbook_teachers',
      classes: 'openacademy_textbook_classes',
      students: 'openacademy_textbook_students',
      studentRequests: 'openacademy_textbook_student_requests',
      books: 'openacademy_textbook_books',
      classBooks: 'openacademy_textbook_class_books',
      inspections: 'openacademy_textbook_inspections',
      configs: 'openacademy_textbook_configs'
    });
  });
});
