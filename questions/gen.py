import requests
from bs4 import BeautifulSoup
from openai import OpenAI
from pydantic import BaseModel
from typing import List, Optional
import json
import os
import uuid

CANDIDATE_FILE = 'candidate.json'
SCRATCH_FILE = 'scratch.json'

def read_json_file(file_path):
    if os.path.exists(file_path):
        with open(file_path, 'r') as file:
            return json.load(file)
    else:
        return []

def write_json_file(file_path, data):
    with open(file_path, 'w') as file:
        json.dump(data, file, indent=4)

def append_to_file(file_path, data):
    with open(file_path, 'a') as file:
        file.write('\n\n\n'+data)

def get_chapter_content(chapter_name):
    url = f'https://dev.realworldocaml.org/{chapter_name}.html'
    response = requests.get(url)
    if response.status_code == 200:
        return response.text
    else:
        raise Exception(f"Failed to fetch chapter: {chapter_name}")

# Function to extract level2 and level3 sections
def extract_sections(chapter_html):
    soup = BeautifulSoup(chapter_html, 'html.parser')
    sections = []

    # Find all level2 and level3 sections
    for section in soup.find_all(['section']):
        if 'level2' in section.get('class', []) or 'level3' in section.get('class', []):
            section_title = section.find(['h2', 'h3']).get_text(strip=True) if section.find(['h2', 'h3']) else ''
            section_content = section.get_text(strip=True)
            sections.append({
                'title': section_title,
                'content': section_content
            })
    
    return sections

class Question(BaseModel):
    type: str
    question: str
    choices: Optional[List[str]]
    correct_answers: Optional[List[int]]
    starter_code: Optional[str]
    test_code: Optional[str]
    section: str
    chapter: str

class Questions(BaseModel):
    questions: List[Question]

# Function to generate questions from GPT-4
def generate_questions_from_gpt(section_title, section_content):
    prompt = f"""
    You are an AI tasked with creating difficult and interesting questions from technical content.

    Context:
    - The content comes from the Real World OCaml textbook.
    - The language is OCaml (specifically Jane Street's version with the Base library).
    - For the programming questions, please include both the problem and testing code that verifies the solution.

    Instructions:
    1. Analyze the section content provided.
    2. Highlight 3-5 interesting/challenging parts of the section that could be turned into questions.
    3. Generate 1-2 multiple choice questions (MCQ) based on these interesting parts.
    4. Generate 1-2 difficult programming problems that require implementation, especially challenging algorithms or complex functions. Make sure to include verification code that checks if the implementation is correct.

    Example of MCQ:
    Question: What does the function `List.fold_left` do in OCaml?
    Choices:
    A) Accumulates values from left to right
    B) Accumulates values from right to left
    C) Creates a new list by appending elements
    D) Finds the maximum element in a list

    Example of Programming Question:
    Question: Implement a function that sums a list of integers, returning the total.
    Starter Code: 
    ```ocaml
    let sum lst = 
        (* your code here *)
    ```
    Test Code:
    ```ocaml
    let () = 
        assert (sum [1;2;3] = 6);
        assert (sum [-1; 0; 1] = 0)
    ```

    Output:
    Return the questions in the following structured JSON format:
    [
        {{
            "type": "multiple_choice",  # or "programming"
            "question": "What does the function `List.fold_left` do in OCaml?",
            "choices": ["Accumulates values from left to right", "Accumulates values from right to left", "Creates a new list", "Finds the maximum element"],
            "correct_answers": [0],  # Indices of correct answers
            "starter_code": "",
            "test_code": "",
            "section": "Exception Handling",
            "chapter": "Error Handling"
        }},
        {{
            "type": "programming",
            "question": "Implement a function to calculate the sum of a list of integers in OCaml.",
            "starter_code": "let sum lst = (* your code here *)",
            "test_code": \"\"\"
                let () = 
                    assert (sum [1; 2; 3] = 6);
                    assert (sum [-1; 0; 1] = 0)
            \"\"\",
            "section": "Exception Handling",
            "chapter": "Error Handling"
        }}
    ]
    
    Section Title: {section_title}
    Section Content: {section_content}
    """

    client = OpenAI(
        api_key=os.environ.get("OPENAI_CAMEL_KEY"),
    )

    completion = client.beta.chat.completions.parse(
        model="gpt-4o-mini",
        messages=[
            {"role": "user", "content": prompt}
        ],
        response_format=Questions,  # Use the Question schema defined above
    )

    questions = completion.choices[0].message.parsed
    return questions

def parse_gpt_output(gpt_output, chapter_name, section_title):
    try:
        formatted_questions = []
        
        for question in gpt_output.questions:
            formatted_questions.append({
                'id': str(uuid.uuid4()),  # Generate a short UUID
                'chapter': chapter_name,
                'section': section_title,
                'type': question.type,
                'question': question.question,
                'choices': question.choices or [],
                'correct_answers': question.correct_answers or [],
                'starter_code': question.starter_code or '',
                'test_code': question.test_code or '',
                'metadata': {
                    'num_solves': 0,
                    'is_deactivated': False,
                    'quality_score': 5
                }
            })
        
        return True, formatted_questions
    
    except Exception as e:
        print(f"Error parsing GPT output: {e}")
        
        append_to_file(SCRATCH_FILE, gpt_output)
        return False, []

def main(chapter_name):
    chapter_html = get_chapter_content(chapter_name)
    sections = extract_sections(chapter_html)
    
    current_questions = read_json_file(CANDIDATE_FILE)
    all_questions = []
    for section in sections:
        print(f"Generating questions for section: {section['title']}")
        gpt_output = generate_questions_from_gpt(section['title'], section['content'])
        
        success, questions = parse_gpt_output(gpt_output, chapter_name, section['title'])
        if success:
            all_questions.extend(questions)
            write_json_file(CANDIDATE_FILE, current_questions + all_questions)
        else:
            print(f"Failed to compile questions for section: {section['title']}, output saved to scratch.json")
        
    print("Processing complete.")

if __name__ == '__main__':
    chapter_name = 'error-handling'
    main(chapter_name)
