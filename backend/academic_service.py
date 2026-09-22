"""
Academic Vault & Lodge Service
Provides access to departmental past questions, lecture handouts, and off-campus accommodation listings.
"""

from datetime import datetime
from typing import List, Optional
from sqlalchemy.orm import Session
import models

DEFAULT_PAST_QUESTIONS = [
    {
        "course_code": "GST 111",
        "course_title": "Use of English & Communication Skills",
        "faculty": "General Studies",
        "department": "General Studies",
        "level": "100L",
        "semester": "1st Semester",
        "exam_year": "2024/2025",
        "content_text": "Section A: Comprehension & Summary Writing.\nSection B: Lexis, Structure & Antonyms/Synonyms.\nSection C: Mechanics of Writing & Sentence Fragments.\n\nSample Question 1: Differentiate between a clause and a phrase with two clear university-level examples.\nSample Question 2: Identify the primary topic sentence in the provided excerpt on Digital Ethics.",
        "downloads_count": 342
    },
    {
        "course_code": "MTH 101",
        "course_title": "Elementary Mathematics I (Algebra & Trigonometry)",
        "faculty": "Science",
        "department": "Mathematics",
        "level": "100L",
        "semester": "1st Semester",
        "exam_year": "2024/2025",
        "content_text": "Section A: Set Theory, Complex Numbers, Mathematical Induction.\nSection B: Quadratic Equations, Partial Fractions, Binomial Expansion.\nSection C: Trigonometric Identities and Equations.\n\nSample Problem 1: Prove by mathematical induction that 1 + 2 + ... + n = n(n+1)/2 for all n >= 1.\nSample Problem 2: Resolve into partial fractions: (3x + 5) / ((x - 1)(x + 2)).",
        "downloads_count": 519
    },
    {
        "course_code": "CSC 201",
        "course_title": "Computer Programming & Algorithm Design (Python & C)",
        "faculty": "Science",
        "department": "Computer Science",
        "level": "200L",
        "semester": "1st Semester",
        "exam_year": "2024/2025",
        "content_text": "Section A: Algorithm Analysis & Big-O Notation.\nSection B: Data Structures (Arrays, Linked Lists, Stacks).\nSection C: Practical Coding in Python & C.\n\nSample Task 1: Write an optimal Python algorithm to detect duplicates in a list in O(n) time complexity.\nSample Task 2: Discuss memory allocation using malloc() and free() in C.",
        "downloads_count": 428
    },
    {
        "course_code": "CHM 101",
        "course_title": "General Chemistry I (Physical & Inorganic Chemistry)",
        "faculty": "Science",
        "department": "Pure & Applied Chemistry",
        "level": "100L",
        "semester": "1st Semester",
        "exam_year": "2023/2024",
        "content_text": "Section A: Atomic Structure, Quantum Numbers, Periodic Trends.\nSection B: Chemical Bonding, Stoichiometry, Ideal Gas Laws.\nSection C: Chemical Kinetics and Equilibrium.\n\nSample Problem 1: Calculate the standard enthalpy of formation using Hess's Law.\nSample Problem 2: State Le Chatelier's Principle and explain its application to Haber's process.",
        "downloads_count": 287
    },
    {
        "course_code": "ACC 101",
        "course_title": "Principles of Accounting I",
        "faculty": "Management Sciences",
        "department": "Accounting",
        "level": "100L",
        "semester": "1st Semester",
        "exam_year": "2024/2025",
        "content_text": "Section A: The Accounting Equation, Double-Entry Principles.\nSection B: Cash Book, Trial Balance, Bank Reconciliation Statement.\nSection C: Final Accounts of a Sole Trader with Adjustments.\n\nSample Question: Prepare a 10-column Statement of Comprehensive Income given the trial balance and unrecorded depreciation.",
        "downloads_count": 315
    },
    {
        "course_code": "LAW 201",
        "course_title": "Nigerian Legal System I",
        "faculty": "Law",
        "department": "Public & Private Law",
        "level": "200L",
        "semester": "1st Semester",
        "exam_year": "2024/2025",
        "content_text": "Section A: Sources of Nigerian Law (Received English Law, Customary Law, Judicial Precedent).\nSection B: Hierarchy of Courts and Doctrine of Stare Decisis.\nSection C: Administration of Justice in Nigeria.\n\nSample Essay: Critically evaluate the validity of Customary Law under the Repugnancy Test.",
        "downloads_count": 194
    },
    {
        "course_code": "ECO 201",
        "course_title": "Microeconomic Theory I",
        "faculty": "Social Sciences",
        "department": "Economics",
        "level": "200L",
        "semester": "1st Semester",
        "exam_year": "2023/2024",
        "content_text": "Section A: Consumer Behavior, Cardinal vs Ordinal Utility, Indifference Curve Analysis.\nSection B: Theory of Production and Costs (Cobb-Douglas Production Function).\nSection C: Market Structures (Perfect Competition vs Monopoly).\n\nSample Problem: Derive the demand curve from the price-consumption curve for normal goods.",
        "downloads_count": 240
    }
]

DEFAULT_LODGES = [
    {
        "title": "Modern Self-Contained Apartment near Main Campus Gate",
        "lodge_name": "Peace Haven Villa",
        "location": "Behind Campus Main Gate (2 mins walk)",
        "price_per_year": 180000.0,
        "room_type": "Self-contained",
        "amenities": "Running Borehole Water, Pre-paid Light Meter, Fully Tiled, Security Guard",
        "contact_phone": "08031234567",
        "image_url": "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&auto=format&fit=crop&q=80"
    },
    {
        "title": "Affordable Single Room Lodge with Constant Water",
        "lodge_name": "Royal Palm Court",
        "location": "Adjacent University Sports Complex",
        "price_per_year": 110000.0,
        "room_type": "Single Room",
        "amenities": "Borehole, Fenced Compound, Pre-paid Meter, Well Ventilated",
        "contact_phone": "08129876543",
        "image_url": "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&auto=format&fit=crop&q=80"
    },
    {
        "title": "Spacious 2-Bedroom Flat for Student Roommates",
        "lodge_name": "Harmony Executive Suites",
        "location": "Campus Hilltop Road",
        "price_per_year": 320000.0,
        "room_type": "2-Bedroom Flat",
        "amenities": "2 En-suite Bedrooms, Prepaid Meter, Kitchen Cabinets, Gated Security",
        "contact_phone": "07054321098",
        "image_url": "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&auto=format&fit=crop&q=80"
    },
    {
        "title": "Clean Self-Con near Faculty of Science & Engineering",
        "lodge_name": "Grace Divine Lodge",
        "location": "Faculty Back Gate, Off Campus Road",
        "price_per_year": 150000.0,
        "room_type": "Self-contained",
        "amenities": "Quiet Environment, Running Water, Tiled, Safe for Night Readers",
        "contact_phone": "08087654321",
        "image_url": "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800&auto=format&fit=crop&q=80"
    }
]

def seed_academic_and_lodges(db: Session):
    """Seed benchmark past questions and lodges if empty."""
    try:
        if db.query(models.PastQuestion).count() < len(DEFAULT_PAST_QUESTIONS):
            for pq in DEFAULT_PAST_QUESTIONS:
                exists = db.query(models.PastQuestion).filter(models.PastQuestion.course_code == pq["course_code"]).first()
                if not exists:
                    db.add(models.PastQuestion(**pq))
            db.commit()

        if db.query(models.LodgeListing).count() < len(DEFAULT_LODGES):
            # Find an existing admin or student user ID to assign as default poster
            first_user = db.query(models.User).first()
            first_uni = db.query(models.University).first()
            if first_user and first_uni:
                for lodge in DEFAULT_LODGES:
                    exists = db.query(models.LodgeListing).filter(models.LodgeListing.lodge_name == lodge["lodge_name"]).first()
                    if not exists:
                        db.add(models.LodgeListing(
                            university_id=first_uni.id,
                            user_id=first_user.user_id,
                            **lodge
                        ))
                db.commit()
    except Exception as e:
        db.rollback()
        print(f"[Academic Service] Auto-seed notice: {e}")
