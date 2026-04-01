from __future__ import annotations

from pytest_bdd import given, parsers, then, when
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait


def _wait(driver, timeout: float = 10.0) -> WebDriverWait:
    return WebDriverWait(driver, timeout)


def _xpath_literal(value: str) -> str:
    if "\"" not in value:
        return f'"{value}"'
    if "'" not in value:
        return f"'{value}'"

    parts = value.split('"')
    items: list[str] = []
    for i, part in enumerate(parts):
        if part:
            items.append(f'"{part}"')
        if i != len(parts) - 1:
            items.append("'\"'")
    return "concat(" + ", ".join(items) + ")"


@given(parsers.parse('I open "{path}"'))
@when(parsers.parse('I open "{path}"'))
def open_path(driver, base_url: str, path: str) -> None:
    url = f"{base_url}{path}" if path.startswith("/") else f"{base_url}/{path}"
    driver.get(url)


@when(parsers.parse('I click the button "{label}"'))
def click_button(driver, label: str) -> None:
    locator = (By.XPATH, f"//button[normalize-space()={_xpath_literal(label)}]")
    button = _wait(driver).until(EC.element_to_be_clickable(locator))
    button.click()


@then(parsers.parse('I should see text "{text}"'))
def should_see_text(driver, text: str) -> None:
    literal = _xpath_literal(text)
    locator = (By.XPATH, f"//*[contains(normalize-space(), {literal})]")
    _wait(driver).until(EC.presence_of_element_located(locator))


@then(parsers.parse('I should see an input of type "{input_type}"'))
def should_see_input_type(driver, input_type: str) -> None:
    locator = (By.CSS_SELECTOR, f'input[type="{input_type}"]')
    _wait(driver).until(EC.presence_of_element_located(locator))


@then(parsers.parse('I should see a button with text "{label}"'))
def should_see_button_text(driver, label: str) -> None:
    locator = (By.XPATH, f"//button[normalize-space()={_xpath_literal(label)}]")
    _wait(driver).until(EC.presence_of_element_located(locator))


@then(parsers.parse('I should see an h1 "{heading}"'))
def should_see_h1(driver, heading: str) -> None:
    locator = (By.XPATH, f"//h1[normalize-space()={_xpath_literal(heading)}]")
    _wait(driver).until(EC.presence_of_element_located(locator))
