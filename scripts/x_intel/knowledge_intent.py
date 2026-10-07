"""Question purpose shared by retrieval gates and authority ranking.

Current availability and recent updates are distinct from explanations and
historical lookup; neither should be inferred from document retention alone.
"""
from __future__ import annotations

import re


def historical_question(question: str) -> bool:
    q = question.casefold()
    return any(term in q for term in (
        "之前", "已結束", "已结束", "上週", "上周", "過去", "过去", "回顧", "回顾",
        "歷史", "历史", "past", "ended", "last week", "recap", "historical", "지난", "과거",
    ))


def definition_question(question: str) -> bool:
    q = question.casefold()
    return any(term in q for term in (
        "是什麼", "是什么", "什麼是", "什么是", "介紹", "介绍", "怎麼用", "怎么用",
        "如何使用", "教學", "教学", "what is", "explain", "how does", "how to use",
        "무엇", "사용 방법",
    ))


def product_update_question(question: str) -> bool:
    q = question.casefold()
    product = bool(re.search(
        r"產品|产品|功能|卡機|卡机|卡包|介面|界面|\b(?:products?|features?|packs?|buyback|fair|index|vinci|merch)\b|제품|기능", q
    ))
    update = any(term in q for term in (
        "進展", "进展", "更新", "新功能", "改版", "消息", "動態", "动态",
        "progress", "development", "update", "news", "what's new", "what’s new", "what is new",
        "new feature", "업데이트", "새 소식",
    ))
    # "What is new?" asks for changes rather than a definition.
    concept = definition_question(q) and not any(term in q for term in (
        "what's new", "what’s new", "what is new",
    ))
    return product and update and not concept


def participation_question(question: str) -> bool:
    q = question.casefold()
    return any(term in q for term in (
        "參與", "参与", "參加", "参加", "報名", "报名", "申請", "申请",
        "join", "participate", "register", "registration", "sign up", "signup", "참여", "신청",
    ))
