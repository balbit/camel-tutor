import { extractRunnableCode } from "./extract-ocaml.js";
import { EditorContainer } from "./init-editor.js";
import { submitCode } from "./api.js";

interface Question {
    id: number;
    chapter: string;
    section: string;
    type: "multiple_choice" | "programming";
    question: string;
    choices: string[];
    correct_answers: number[];
    starter_code: string;
    test_code: string;
    metadata: {
        num_solves: number;
        is_deactivated: boolean;
        quality_score: number;
    };
}

interface QuizContainerProps {
    question: Question;
    onSubmit: (isCorrect: boolean, feedback: string) => void;
}

async function loadQuestions(chapter: string): Promise<Question[]> {
    const sessionId = localStorage.getItem("sessionId") || crypto.randomUUID();
    localStorage.setItem("sessionId", sessionId);

    const response = fetch(`https://camel.elliotliu.com/get-questions?sessionId=${sessionId}&chapter=${encodeURIComponent(chapter)}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
    });

    const data = await response.then((res) => res.json());
    return data.questions;
}

function findSections(): HTMLElement[] {
    return Array.from(document.querySelectorAll("section.level2, section.level3"));
}

function findRandomQuestion(questions: Question[], sectionId: string): Question | null {
    const filteredQuestions = questions.filter(
        (question) => question.section.replace(/\s+/g, "-").toLowerCase() === sectionId.toLowerCase()
    );
    if (filteredQuestions.length === 0) {
        return null;
    }
    const randomIndex = Math.floor(Math.random() * filteredQuestions.length);
    return filteredQuestions[randomIndex];
}

function createQuizContainer(props: QuizContainerProps, section: HTMLElement, monaco: any): HTMLElement {
    const container = document.createElement("div");
    container.className = "quiz-container";

    const questionElement = document.createElement("p");
    questionElement.className = "quiz-question";
    questionElement.innerText = props.question.question;
    container.appendChild(questionElement);
    section.appendChild(container);

    if (props.question.type === "multiple_choice") {
        const choicesContainer = document.createElement("div");
        choicesContainer.className = "quiz-choices";

        props.question.choices.forEach((choice, index) => {
            const choiceElement = document.createElement("div");
            choiceElement.className = "quiz-choice";

            const radioInput = document.createElement("input");
            radioInput.type = "radio";
            radioInput.name = `quiz-${props.question.id}`;
            radioInput.value = index.toString();

            const label = document.createElement("label");
            label.innerText = choice;

            choiceElement.appendChild(radioInput);
            choiceElement.appendChild(label);
            choicesContainer.appendChild(choiceElement);
        });

        container.appendChild(choicesContainer);

        const submitButton = document.createElement("button");
        submitButton.className = "quiz-submit-button";
        submitButton.innerText = "Submit";
        submitButton.onclick = () => {
            const selected = choicesContainer.querySelector<HTMLInputElement>("input:checked");
            if (!selected) {
                alert("Please select an option");
                return;
            }
            const isCorrect = props.question.correct_answers.includes(Number(selected.value));
            props.onSubmit(isCorrect, isCorrect ? "Correct!" : "Incorrect, try again.");
        };

        container.appendChild(submitButton);
    } else if (props.question.type === "programming") {
        const editorContainerId = `quiz-editor-container-${props.question.id}`;
        const editorDiv = document.createElement("div");
        editorDiv.id = editorContainerId;
        container.appendChild(editorDiv);

        const outputChecker = async (userCode: string) => {
            const testCode = props.question.test_code;
            // Run the test code with the user's code
            const runnableCode = extractRunnableCode(userCode);
            const codeToRun = `${runnableCode}\n${testCode}`;
            const result = await submitCode(codeToRun);
            const ret: [boolean, string] =  [true, result.output];
            return ret;
        };

        const editor = new EditorContainer(editorContainerId, props.question.starter_code, monaco, outputChecker);
    }

    return container;
}

export async function initializeQuizzes(): Promise<void> {
    const chapter = document.querySelector("section.level1")?.id;
    const questions = await loadQuestions(chapter ?? "all");
    const sections = findSections();

    sections.forEach((section) => {
        const sectionId = section.id;
        const question = findRandomQuestion(questions, sectionId);

        if (question) {
            const quizContainer = createQuizContainer({
                question,
                onSubmit: (isCorrect, feedback) => {
                    alert(feedback);
                    if (isCorrect) {
                        section.style.backgroundColor = "#D4EDDA"; // Light green background for success
                    } else {
                        section.style.backgroundColor = "#F8D7DA"; // Light red background for failure
                    }
                },
            }, section, (window as any).monaco);
            // section.appendChild(quizContainer);
        }
    });
}
