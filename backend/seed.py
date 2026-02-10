from sqlalchemy.orm import Session
from models.category import Category, CategoryType

DEFAULT_CATEGORIES = [
    # Expenses
    {"name": "Alimentação", "icon": "utensils", "color": "#F97316", "type": CategoryType.EXPENSE},
    {"name": "Transporte", "icon": "car", "color": "#3B82F6", "type": CategoryType.EXPENSE},
    {"name": "Moradia", "icon": "home", "color": "#8B5CF6", "type": CategoryType.EXPENSE},
    {"name": "Saúde", "icon": "heart-pulse", "color": "#EF4444", "type": CategoryType.EXPENSE},
    {"name": "Lazer", "icon": "gamepad-2", "color": "#EC4899", "type": CategoryType.EXPENSE},
    {"name": "Educação", "icon": "graduation-cap", "color": "#14B8A6", "type": CategoryType.EXPENSE},
    {"name": "Compras", "icon": "shopping-bag", "color": "#F59E0B", "type": CategoryType.EXPENSE},
    {"name": "Assinaturas", "icon": "tv", "color": "#6366F1", "type": CategoryType.EXPENSE},
    {"name": "Pets", "icon": "paw-print", "color": "#A855F7", "type": CategoryType.EXPENSE},
    {"name": "Outros (Despesa)", "icon": "circle-dot", "color": "#64748B", "type": CategoryType.EXPENSE},
    # Income
    {"name": "Salário", "icon": "briefcase", "color": "#10B981", "type": CategoryType.INCOME},
    {"name": "Freelance", "icon": "laptop", "color": "#06B6D4", "type": CategoryType.INCOME},
    {"name": "Investimentos", "icon": "trending-up", "color": "#22C55E", "type": CategoryType.INCOME},
    {"name": "Presente", "icon": "gift", "color": "#F43F5E", "type": CategoryType.INCOME},
    {"name": "Outros (Receita)", "icon": "circle-dot", "color": "#64748B", "type": CategoryType.INCOME},
]


def seed_categories(db: Session):
    """Insert default categories if none exist."""
    existing = db.query(Category).count()
    if existing > 0:
        return

    for cat_data in DEFAULT_CATEGORIES:
        cat = Category(**cat_data)
        db.add(cat)

    db.commit()
