"""Simple keyword-based tab grouping.

Looks at each tab's URL and title, checks it against a few keyword lists,
and puts it into a matching category. Basic if/else logic - no ML needed.
"""

CATEGORIES = {
    "Coding": ["github", "stackoverflow", "leetcode", "gitlab"],
    "Learning": ["coursera", "udemy", "khanacademy", "youtube"],
    "Career": ["linkedin", "indeed", "naukri", "glassdoor"],
}


def group_tabs(tabs):
    """Takes a list of tabs (each with .url and .title) and returns a dict
    like {"Coding": [tab1, tab2], "Learning": [tab3], "Other": [tab4]}.
    """
    groups = {"Other": []}
    for category in CATEGORIES:
        groups[category] = []

    for tab in tabs:
        text_to_check = (tab.url + " " + tab.title).lower()
        matched = False

        for category, keywords in CATEGORIES.items():
            for keyword in keywords:
                if keyword in text_to_check:
                    groups[category].append(tab)
                    matched = True
                    break
            if matched:
                break

        if not matched:
            groups["Other"].append(tab)

    return groups
