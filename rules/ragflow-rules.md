CHAT ASSISTANT MANAGEMENT
Create chat assistant
POST /api/v1/chats

Creates a chat assistant.

Request
Method: POST
URL: /api/v1/chats
Headers:
'content-Type: application/json'
'Authorization: Bearer <YOUR_API_KEY>'
Body:
"name": string
"avatar": string
"dataset_ids": list[string]
"llm": object
"prompt": object
Request example
curl --request POST \
     --url http://{address}/api/v1/chats \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <YOUR_API_KEY>' \
     --data '{
    "dataset_ids": ["0b2cbc8c877f11ef89070242ac120005"],
    "name":"new_chat_1"
}'

Request parameters
"name": (Body parameter), string, Required
The name of the chat assistant.
"avatar": (Body parameter), string
Base64 encoding of the avatar.
"dataset_ids": (Body parameter), list[string]
The IDs of the associated datasets.
"llm": (Body parameter), object
The LLM settings for the chat assistant to create. If it is not explicitly set, a JSON object with the following values will be generated as the default. An llm JSON object contains the following attributes:
"model_name", string
The chat model name. If not set, the user's default chat model will be used.
"temperature": float
Controls the randomness of the model's predictions. A lower temperature results in more conservative responses, while a higher temperature yields more creative and diverse responses. Defaults to 0.1.
"top_p": float
Also known as “nucleus sampling”, this parameter sets a threshold to select a smaller set of words to sample from. It focuses on the most likely words, cutting off the less probable ones. Defaults to 0.3
"presence_penalty": float
This discourages the model from repeating the same information by penalizing words that have already appeared in the conversation. Defaults to 0.4.
"frequency penalty": float
Similar to the presence penalty, this reduces the model’s tendency to repeat the same words frequently. Defaults to 0.7.
"prompt": (Body parameter), object
Instructions for the LLM to follow. If it is not explicitly set, a JSON object with the following values will be generated as the default. A prompt JSON object contains the following attributes:
"similarity_threshold": float RAGFlow employs either a combination of weighted keyword similarity and weighted vector cosine similarity, or a combination of weighted keyword similarity and weighted reranking score during retrieval. This argument sets the threshold for similarities between the user query and chunks. If a similarity score falls below this threshold, the corresponding chunk will be excluded from the results. The default value is 0.2.
"keywords_similarity_weight": float This argument sets the weight of keyword similarity in the hybrid similarity score with vector cosine similarity or reranking model similarity. By adjusting this weight, you can control the influence of keyword similarity in relation to other similarity measures. The default value is 0.7.
"top_n": int This argument specifies the number of top chunks with similarity scores above the similarity_threshold that are fed to the LLM. The LLM will only access these 'top N' chunks. The default value is 6.
"variables": object[] This argument lists the variables to use in the 'System' field of Chat Configurations. Note that:
"knowledge" is a reserved variable, which represents the retrieved chunks.
All the variables in 'System' should be curly bracketed.
The default value is [{"key": "knowledge", "optional": true}].
"rerank_model": string If it is not specified, vector cosine similarity will be used; otherwise, reranking score will be used.
top_k: int Refers to the process of reordering or selecting the top-k items from a list or set based on a specific ranking criterion. Default to 1024.
"empty_response": string If nothing is retrieved in the dataset for the user's question, this will be used as the response. To allow the LLM to improvise when nothing is found, leave this blank.
"opener": string The opening greeting for the user. Defaults to "Hi! I am your assistant, can I help you?".
"show_quote: boolean Indicates whether the source of text should be displayed. Defaults to true.
"prompt": string The prompt content.
Response
Success:

{
    "code": 0,
    "data": {
        "avatar": "",
        "create_date": "Thu, 24 Oct 2024 11:18:29 GMT",
        "create_time": 1729768709023,
        "dataset_ids": [
            "527fa74891e811ef9c650242ac120006"
        ],
        "description": "A helpful Assistant",
        "do_refer": "1",
        "id": "b1f2f15691f911ef81180242ac120003",
        "language": "English",
        "llm": {
            "frequency_penalty": 0.7,
            "model_name": "qwen-plus@Tongyi-Qianwen",
            "presence_penalty": 0.4,
            "temperature": 0.1,
            "top_p": 0.3
        },
        "name": "12234",
        "prompt": {
            "empty_response": "Sorry! No relevant content was found in the knowledge base!",
            "keywords_similarity_weight": 0.3,
            "opener": "Hi! I'm your assistant. What can I do for you?",
            "prompt": "You are an intelligent assistant. Please summarize the content of the knowledge base to answer the question. Please list the data in the knowledge base and answer in detail. When all knowledge base content is irrelevant to the question, your answer must include the sentence \"The answer you are looking for is not found in the knowledge base!\" Answers need to consider chat history.\n ",
            "rerank_model": "",
            "similarity_threshold": 0.2,
            "top_n": 6,
            "variables": [
                {
                    "key": "knowledge",
                    "optional": false
                }
            ]
        },
        "prompt_type": "simple",
        "status": "1",
        "tenant_id": "69736c5e723611efb51b0242ac120007",
        "top_k": 1024,
        "update_date": "Thu, 24 Oct 2024 11:18:29 GMT",
        "update_time": 1729768709023
    }
}


Failure:

{
    "code": 102,
    "message": "Duplicated chat name in creating dataset."
}

Update chat assistant
PUT /api/v1/chats/{chat_id}

Updates configurations for a specified chat assistant.

Request
Method: PUT
URL: /api/v1/chats/{chat_id}
Headers:
'content-Type: application/json'
'Authorization: Bearer <YOUR_API_KEY>'
Body:
"name": string
"avatar": string
"dataset_ids": list[string]
"llm": object
"prompt": object
Request example
curl --request PUT \
     --url http://{address}/api/v1/chats/{chat_id} \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <YOUR_API_KEY>' \
     --data '
     {
          "name":"Test"
     }'

Parameters
chat_id: (Path parameter)
The ID of the chat assistant to update.
"name": (Body parameter), string, Required
The revised name of the chat assistant.
"avatar": (Body parameter), string
Base64 encoding of the avatar.
"dataset_ids": (Body parameter), list[string]
The IDs of the associated datasets.
"llm": (Body parameter), object
The LLM settings for the chat assistant to create. If it is not explicitly set, a dictionary with the following values will be generated as the default. An llm object contains the following attributes:
"model_name", string
The chat model name. If not set, the user's default chat model will be used.
"temperature": float
Controls the randomness of the model's predictions. A lower temperature results in more conservative responses, while a higher temperature yields more creative and diverse responses. Defaults to 0.1.
"top_p": float
Also known as “nucleus sampling”, this parameter sets a threshold to select a smaller set of words to sample from. It focuses on the most likely words, cutting off the less probable ones. Defaults to 0.3
"presence_penalty": float
This discourages the model from repeating the same information by penalizing words that have already appeared in the conversation. Defaults to 0.2.
"frequency penalty": float
Similar to the presence penalty, this reduces the model’s tendency to repeat the same words frequently. Defaults to 0.7.
"prompt": (Body parameter), object
Instructions for the LLM to follow. A prompt object contains the following attributes:
"similarity_threshold": float RAGFlow employs either a combination of weighted keyword similarity and weighted vector cosine similarity, or a combination of weighted keyword similarity and weighted rerank score during retrieval. This argument sets the threshold for similarities between the user query and chunks. If a similarity score falls below this threshold, the corresponding chunk will be excluded from the results. The default value is 0.2.
"keywords_similarity_weight": float This argument sets the weight of keyword similarity in the hybrid similarity score with vector cosine similarity or reranking model similarity. By adjusting this weight, you can control the influence of keyword similarity in relation to other similarity measures. The default value is 0.7.
"top_n": int This argument specifies the number of top chunks with similarity scores above the similarity_threshold that are fed to the LLM. The LLM will only access these 'top N' chunks. The default value is 8.
"variables": object[] This argument lists the variables to use in the 'System' field of Chat Configurations. Note that:
"knowledge" is a reserved variable, which represents the retrieved chunks.
All the variables in 'System' should be curly bracketed.
The default value is [{"key": "knowledge", "optional": true}]
"rerank_model": string If it is not specified, vector cosine similarity will be used; otherwise, reranking score will be used.
"empty_response": string If nothing is retrieved in the dataset for the user's question, this will be used as the response. To allow the LLM to improvise when nothing is found, leave this blank.
"opener": string The opening greeting for the user. Defaults to "Hi! I am your assistant, can I help you?".
"show_quote: boolean Indicates whether the source of text should be displayed. Defaults to true.
"prompt": string The prompt content.
Response
Success:

{
    "code": 0
}

Failure:

{
    "code": 102,
    "message": "Duplicated chat name in updating dataset."
}

Delete chat assistants
DELETE /api/v1/chats

Deletes chat assistants by ID.

Request
Method: DELETE
URL: /api/v1/chats
Headers:
'content-Type: application/json'
'Authorization: Bearer <YOUR_API_KEY>'
Body:
"ids": list[string]
Request example
curl --request DELETE \
     --url http://{address}/api/v1/chats \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <YOUR_API_KEY>' \
     --data '
     {
          "ids": ["test_1", "test_2"]
     }'

Request parameters
"ids": (Body parameter), list[string]
The IDs of the chat assistants to delete. If it is not specified, all chat assistants in the system will be deleted.
Response
Success:

{
    "code": 0
}

Failure:

{
    "code": 102,
    "message": "ids are required"
}

List chat assistants
GET /api/v1/chats?page={page}&page_size={page_size}&orderby={orderby}&desc={desc}&name={chat_name}&id={chat_id}

Lists chat assistants.

Request
Method: GET
URL: /api/v1/chats?page={page}&page_size={page_size}&orderby={orderby}&desc={desc}&name={chat_name}&id={chat_id}
Headers:
'Authorization: Bearer <YOUR_API_KEY>'
Request example
curl --request GET \
     --url http://{address}/api/v1/chats?page={page}&page_size={page_size}&orderby={orderby}&desc={desc}&name={chat_name}&id={chat_id} \
     --header 'Authorization: Bearer <YOUR_API_KEY>'


Request parameters
page: (Filter parameter), integer
Specifies the page on which the chat assistants will be displayed. Defaults to 1.
page_size: (Filter parameter), integer
The number of chat assistants on each page. Defaults to 30.
orderby: (Filter parameter), string
The attribute by which the results are sorted. Available options:
create_time (default)
update_time
desc: (Filter parameter), boolean
Indicates whether the retrieved chat assistants should be sorted in descending order. Defaults to true.
id: (Filter parameter), string
The ID of the chat assistant to retrieve.
name: (Filter parameter), string
The name of the chat assistant to retrieve.
Response
Success:

{
    "code": 0,
    "data": [
        {
            "avatar": "",
            "create_date": "Fri, 18 Oct 2024 06:20:06 GMT",
            "create_time": 1729232406637,
            "description": "A helpful Assistant",
            "do_refer": "1",
            "id": "04d0d8e28d1911efa3630242ac120006",
            "dataset_ids": ["527fa74891e811ef9c650242ac120006"],
            "language": "English",
            "llm": {
                "frequency_penalty": 0.7,
                "model_name": "qwen-plus@Tongyi-Qianwen",
                "presence_penalty": 0.4,
                "temperature": 0.1,
                "top_p": 0.3
            },
            "name": "13243",
            "prompt": {
                "empty_response": "Sorry! No relevant content was found in the knowledge base!",
                "keywords_similarity_weight": 0.3,
                "opener": "Hi! I'm your assistant. What can I do for you?",
                "prompt": "You are an intelligent assistant. Please summarize the content of the knowledge base to answer the question. Please list the data in the knowledge base and answer in detail. When all knowledge base content is irrelevant to the question, your answer must include the sentence \"The answer you are looking for is not found in the knowledge base!\" Answers need to consider chat history.\n",
                "rerank_model": "",
                "similarity_threshold": 0.2,
                "top_n": 6,
                "variables": [
                    {
                        "key": "knowledge",
                        "optional": false
                    }
                ]
            },
            "prompt_type": "simple",
            "status": "1",
            "tenant_id": "69736c5e723611efb51b0242ac120007",
            "top_k": 1024,
            "update_date": "Fri, 18 Oct 2024 06:20:06 GMT",
            "update_time": 1729232406638
        }
    ]
}


Failure:

{
    "code": 102,
    "message": "The chat doesn't exist"
}

SESSION MANAGEMENT
Create session with chat assistant
POST /api/v1/chats/{chat_id}/sessions

Creates a session with a chat assistant.

Request
Method: POST
URL: /api/v1/chats/{chat_id}/sessions
Headers:
'content-Type: application/json'
'Authorization: Bearer <YOUR_API_KEY>'
Body:
"name": string
"user_id": string (optional)
Request example
curl --request POST \
     --url http://{address}/api/v1/chats/{chat_id}/sessions \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <YOUR_API_KEY>' \
     --data '
     {
          "name": "new session"
     }'

Request parameters
chat_id: (Path parameter)
The ID of the associated chat assistant.
"name": (Body parameter), string
The name of the chat session to create.
"user_id": (Body parameter), string
Optional user-defined ID.
Response
Success:

{
    "code": 0,
    "data": {
        "chat_id": "2ca4b22e878011ef88fe0242ac120005",
        "create_date": "Fri, 11 Oct 2024 08:46:14 GMT",
        "create_time": 1728636374571,
        "id": "4606b4ec87ad11efbc4f0242ac120006",
        "messages": [
            {
                "content": "Hi! I am your assistant, can I help you?",
                "role": "assistant"
            }
        ],
        "name": "new session",
        "update_date": "Fri, 11 Oct 2024 08:46:14 GMT",
        "update_time": 1728636374571
    }
}

Failure:

{
    "code": 102,
    "message": "Name cannot be empty."
}

Update chat assistant's session
PUT /api/v1/chats/{chat_id}/sessions/{session_id}

Updates a session of a specified chat assistant.

Request
Method: PUT
URL: /api/v1/chats/{chat_id}/sessions/{session_id}
Headers:
'content-Type: application/json'
'Authorization: Bearer <YOUR_API_KEY>'
Body:
"name: string
"user_id: string (optional)
Request example
curl --request PUT \
     --url http://{address}/api/v1/chats/{chat_id}/sessions/{session_id} \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <YOUR_API_KEY>' \
     --data '
     {
          "name": "<REVISED_SESSION_NAME_HERE>"
     }'

Request Parameter
chat_id: (Path parameter)
The ID of the associated chat assistant.
session_id: (Path parameter)
The ID of the session to update.
"name": (Body Parameter), string
The revised name of the session.
"user_id": (Body parameter), string
Optional user-defined ID.
Response
Success:

{
    "code": 0
}

Failure:

{
    "code": 102,
    "message": "Name cannot be empty."
}

List chat assistant's sessions
GET /api/v1/chats/{chat_id}/sessions?page={page}&page_size={page_size}&orderby={orderby}&desc={desc}&name={session_name}&id={session_id}

Lists sessions associated with a specified chat assistant.

Request
Method: GET
URL: /api/v1/chats/{chat_id}/sessions?page={page}&page_size={page_size}&orderby={orderby}&desc={desc}&name={session_name}&id={session_id}&user_id={user_id}
Headers:
'Authorization: Bearer <YOUR_API_KEY>'
Request example
curl --request GET \
     --url http://{address}/api/v1/chats/{chat_id}/sessions?page={page}&page_size={page_size}&orderby={orderby}&desc={desc}&name={session_name}&id={session_id} \
     --header 'Authorization: Bearer <YOUR_API_KEY>'


Request Parameters
chat_id: (Path parameter)
The ID of the associated chat assistant.
page: (Filter parameter), integer
Specifies the page on which the sessions will be displayed. Defaults to 1.
page_size: (Filter parameter), integer
The number of sessions on each page. Defaults to 30.
orderby: (Filter parameter), string
The field by which sessions should be sorted. Available options:
create_time (default)
update_time
desc: (Filter parameter), boolean
Indicates whether the retrieved sessions should be sorted in descending order. Defaults to true.
name: (Filter parameter) string
The name of the chat session to retrieve.
id: (Filter parameter), string
The ID of the chat session to retrieve.
user_id: (Filter parameter), string
The optional user-defined ID passed in when creating session.
Response
Success:

{
    "code": 0,
    "data": [
        {
            "chat": "2ca4b22e878011ef88fe0242ac120005",
            "create_date": "Fri, 11 Oct 2024 08:46:43 GMT",
            "create_time": 1728636403974,
            "id": "578d541e87ad11ef96b90242ac120006",
            "messages": [
                {
                    "content": "Hi! I am your assistant, can I help you?",
                    "role": "assistant"
                }
            ],
            "name": "new session",
            "update_date": "Fri, 11 Oct 2024 08:46:43 GMT",
            "update_time": 1728636403974
        }
    ]
}

Failure:

{
    "code": 102,
    "message": "The session doesn't exist"
}

Delete chat assistant's sessions
DELETE /api/v1/chats/{chat_id}/sessions

Deletes sessions of a chat assistant by ID.

Request
Method: DELETE
URL: /api/v1/chats/{chat_id}/sessions
Headers:
'content-Type: application/json'
'Authorization: Bearer <YOUR_API_KEY>'
Body:
"ids": list[string]
Request example
curl --request DELETE \
     --url http://{address}/api/v1/chats/{chat_id}/sessions \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <YOUR_API_KEY>' \
     --data '
     {
          "ids": ["test_1", "test_2"]
     }'

Request Parameters
chat_id: (Path parameter)
The ID of the associated chat assistant.
"ids": (Body Parameter), list[string]
The IDs of the sessions to delete. If it is not specified, all sessions associated with the specified chat assistant will be deleted.
Response
Success:

{
    "code": 0
}

Failure:

{
    "code": 102,
    "message": "The chat doesn't own the session"
}

Converse with chat assistant
POST /api/v1/chats/{chat_id}/completions

Asks a specified chat assistant a question to start an AI-powered conversation.

NOTE
In streaming mode, not all responses include a reference, as this depends on the system's judgement.

In streaming mode, the last message is an empty message:

data:
{
  "code": 0,
  "data": true
}

Request
Method: POST
URL: /api/v1/chats/{chat_id}/completions
Headers:
'content-Type: application/json'
'Authorization: Bearer <YOUR_API_KEY>'
Body:
"question": string
"stream": boolean
"session_id": string (optional)
"user_id: string (optional)
Request example
curl --request POST \
     --url http://{address}/api/v1/chats/{chat_id}/completions \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <YOUR_API_KEY>' \
     --data-binary '
     {
     }'

curl --request POST \
     --url http://{address}/api/v1/chats/{chat_id}/completions \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <YOUR_API_KEY>' \
     --data-binary '
     {
          "question": "Who are you",
          "stream": true,
          "session_id":"9fa7691cb85c11ef9c5f0242ac120005"
     }'

Request Parameters
chat_id: (Path parameter)
The ID of the associated chat assistant.
"question": (Body Parameter), string, Required
The question to start an AI-powered conversation.
"stream": (Body Parameter), boolean
Indicates whether to output responses in a streaming way:
true: Enable streaming (default).
false: Disable streaming.
"session_id": (Body Parameter)
The ID of session. If it is not provided, a new session will be generated.
"user_id": (Body parameter), string
The optional user-defined ID. Valid only when no session_id is provided.
Response
Success without session_id:

data:{
    "code": 0,
    "message": "",
    "data": {
        "answer": "Hi! I'm your assistant. What can I do for you?",
        "reference": {},
        "audio_binary": null,
        "id": null,
        "session_id": "b01eed84b85611efa0e90242ac120005"
    }
}
data:{
    "code": 0,
    "message": "",
    "data": true
}

Success with session_id:

data:{
    "code": 0,
    "data": {
        "answer": "I am an intelligent assistant designed to help answer questions by summarizing content from a",
        "reference": {},
        "audio_binary": null,
        "id": "a84c5dd4-97b4-4624-8c3b-974012c8000d",
        "session_id": "82b0ab2a9c1911ef9d870242ac120006"
    }
}
data:{
    "code": 0,
    "data": {
        "answer": "I am an intelligent assistant designed to help answer questions by summarizing content from a knowledge base. My responses are based on the information available in the knowledge base and",
        "reference": {},
        "audio_binary": null,
        "id": "a84c5dd4-97b4-4624-8c3b-974012c8000d",
        "session_id": "82b0ab2a9c1911ef9d870242ac120006"
    }
}
data:{
    "code": 0,
    "data": {
        "answer": "I am an intelligent assistant designed to help answer questions by summarizing content from a knowledge base. My responses are based on the information available in the knowledge base and any relevant chat history.",
        "reference": {},
        "audio_binary": null,
        "id": "a84c5dd4-97b4-4624-8c3b-974012c8000d",
        "session_id": "82b0ab2a9c1911ef9d870242ac120006"
    }
}
data:{
    "code": 0,
    "data": {
        "answer": "I am an intelligent assistant designed to help answer questions by summarizing content from a knowledge base ##0$$. My responses are based on the information available in the knowledge base and any relevant chat history.",
        "reference": {
            "total": 1,
            "chunks": [
                {
                    "id": "faf26c791128f2d5e821f822671063bd",
                    "content": "xxxxxxxx",
                    "document_id": "dd58f58e888511ef89c90242ac120006",
                    "document_name": "1.txt",
                    "dataset_id": "8e83e57a884611ef9d760242ac120006",
                    "image_id": "",
                    "url": null,
                    "similarity": 0.7,
                    "vector_similarity": 0.0,
                    "term_similarity": 1.0,
                    "doc_type": [],
                    "positions": [
                        ""
                    ]
                }
            ],
            "doc_aggs": [
                {
                    "doc_name": "1.txt",
                    "doc_id": "dd58f58e888511ef89c90242ac120006",
                    "count": 1
                }
            ]
        },
        "prompt": "xxxxxxxxxxx",
        "created_at": 1755055623.6401553,
        "id": "a84c5dd4-97b4-4624-8c3b-974012c8000d",
        "session_id": "82b0ab2a9c1911ef9d870242ac120006"
    }
}
data:{
    "code": 0,
    "data": true
}


Failure:

{
    "code": 102,
    "message": "Please input your question."
}

Create session with agent
DEPRECATED
This method is deprecated and not recommended. You can still call it but be mindful that calling Converse with agent will automatically generate a session ID for the associated agent.

POST /api/v1/agents/{agent_id}/sessions

Creates a session with an agent.

Request
Method: POST
URL: /api/v1/agents/{agent_id}/sessions?user_id={user_id}
Headers:
`'content-Type: application/json'
'Authorization: Bearer <YOUR_API_KEY>'
Body:
the required parameters:str
other parameters: The variables specified in the Begin component.
Request example
If the Begin component in your agent does not take required parameters:

curl --request POST \
     --url http://{address}/api/v1/agents/{agent_id}/sessions \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <YOUR_API_KEY>' \
     --data '{
     }'

Request parameters
agent_id: (Path parameter)
The ID of the associated agent.
user_id: (Filter parameter)
The optional user-defined ID for parsing docs (especially images) when creating a session while uploading files.
Response
Success:

{
    "code": 0,
    "data": {
        "agent_id": "dbb4ed366e8611f09690a55a6daec4ef",
        "dsl": {
            "components": {
                "Message:EightyJobsAsk": {
                    "downstream": [],
                    "obj": {
                        "component_name": "Message",
                        "params": {
                            "content": [
                                "{begin@var1}{begin@var2}"
                            ],
                            "debug_inputs": {},
                            "delay_after_error": 2.0,
                            "description": "",
                            "exception_default_value": null,
                            "exception_goto": null,
                            "exception_method": null,
                            "inputs": {},
                            "max_retries": 0,
                            "message_history_window_size": 22,
                            "outputs": {
                                "content": {
                                    "type": "str",
                                    "value": null
                                }
                            },
                            "stream": true
                        }
                    },
                    "upstream": [
                        "begin"
                    ]
                },
                "begin": {
                    "downstream": [
                        "Message:EightyJobsAsk"
                    ],
                    "obj": {
                        "component_name": "Begin",
                        "params": {
                            "debug_inputs": {},
                            "delay_after_error": 2.0,
                            "description": "",
                            "enablePrologue": true,
                            "enable_tips": true,
                            "exception_default_value": null,
                            "exception_goto": null,
                            "exception_method": null,
                            "inputs": {
                                "var1": {
                                    "name": "var1",
                                    "optional": false,
                                    "options": [],
                                    "type": "line",
                                    "value": null
                                },
                                "var2": {
                                    "name": "var2",
                                    "optional": false,
                                    "options": [],
                                    "type": "line",
                                    "value": null
                                }
                            },
                            "max_retries": 0,
                            "message_history_window_size": 22,
                            "mode": "conversational",
                            "outputs": {},
                            "prologue": "Hi! I'm your assistant. What can I do for you?",
                            "tips": "Please fill in the form"
                        }
                    },
                    "upstream": []
                }
            },
            "globals": {
                "sys.conversation_turns": 0,
                "sys.files": [],
                "sys.query": "",
                "sys.user_id": ""
            },
            "graph": {
                "edges": [
                    {
                        "data": {
                            "isHovered": false
                        },
                        "id": "xy-edge__beginstart-Message:EightyJobsAskend",
                        "markerEnd": "logo",
                        "source": "begin",
                        "sourceHandle": "start",
                        "style": {
                            "stroke": "rgba(151, 154, 171, 1)",
                            "strokeWidth": 1
                        },
                        "target": "Message:EightyJobsAsk",
                        "targetHandle": "end",
                        "type": "buttonEdge",
                        "zIndex": 1001
                    }
                ],
                "nodes": [
                    {
                        "data": {
                            "form": {
                                "enablePrologue": true,
                                "inputs": {
                                    "var1": {
                                        "name": "var1",
                                        "optional": false,
                                        "options": [],
                                        "type": "line"
                                    },
                                    "var2": {
                                        "name": "var2",
                                        "optional": false,
                                        "options": [],
                                        "type": "line"
                                    }
                                },
                                "mode": "conversational",
                                "prologue": "Hi! I'm your assistant. What can I do for you?"
                            },
                            "label": "Begin",
                            "name": "begin"
                        },
                        "dragging": false,
                        "id": "begin",
                        "measured": {
                            "height": 112,
                            "width": 200
                        },
                        "position": {
                            "x": 270.64098070942583,
                            "y": -56.320928437811176
                        },
                        "selected": false,
                        "sourcePosition": "left",
                        "targetPosition": "right",
                        "type": "beginNode"
                    },
                    {
                        "data": {
                            "form": {
                                "content": [
                                    "{begin@var1}{begin@var2}"
                                ]
                            },
                            "label": "Message",
                            "name": "Message_0"
                        },
                        "dragging": false,
                        "id": "Message:EightyJobsAsk",
                        "measured": {
                            "height": 57,
                            "width": 200
                        },
                        "position": {
                            "x": 279.5,
                            "y": 190
                        },
                        "selected": true,
                        "sourcePosition": "right",
                        "targetPosition": "left",
                        "type": "messageNode"
                    }
                ]
            },
            "history": [],
            "memory": [],
            "messages": [],
            "path": [],
            "retrieval": [],
            "task_id": "dbb4ed366e8611f09690a55a6daec4ef"
        },
        "id": "0b02fe80780e11f084adcfdc3ed1d902",
        "message": [
            {
                "content": "Hi! I'm your assistant. What can I do for you?",
                "role": "assistant"
            }
        ],
        "source": "agent",
        "user_id": "c3fb861af27a11efa69751e139332ced"
    }
}

Failure:

{
    "code": 102,
    "message": "Agent not found."
}

Converse with agent
POST /api/v1/agents/{agent_id}/completions

Asks a specified agent a question to start an AI-powered conversation.

NOTE
In streaming mode, not all responses include a reference, as this depends on the system's judgement.

In streaming mode, the last message is an empty message:

[DONE]

Request
Method: POST
URL: /api/v1/agents/{agent_id}/completions
Headers:
'content-Type: application/json'
'Authorization: Bearer <YOUR_API_KEY>'
Body:
"question": string
"stream": boolean
"session_id": string (optional)
"inputs": object (optional)
"user_id": string (optional)
IMPORTANT
You can include custom parameters in the request body, but first ensure they are defined in the Begin component.

Request example
If the Begin component does not take parameters:
curl --request POST \
     --url http://{address}/api/v1/agents/{agent_id}/completions \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <YOUR_API_KEY>' \
     --data-binary '
     {
        "question": "Hello",
        "stream": false,
     }'

If the Begin component takes parameters, include their values in the body of "inputs" as follows:
curl --request POST \
     --url http://{address}/api/v1/agents/{agent_id}/completions \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <YOUR_API_KEY>' \
     --data-binary '
    {
        "question": "Hello",
        "stream": false,
        "inputs": {
            "line_var": {
                "type": "line",
                "value": "I am line_var"
            },
            "int_var": {
                "type": "integer",
                "value": 1
            },
            "paragraph_var": {
                "type": "paragraph",
                "value": "a\nb\nc"
            },
            "option_var": {
                "type": "options",
                "value": "option 2"
            },
            "boolean_var": {
                "type": "boolean",
                "value": true
            }
        }
    }'

The following code will execute the completion process

curl --request POST \
     --url http://{address}/api/v1/agents/{agent_id}/completions \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <YOUR_API_KEY>' \
     --data-binary '
     {
          "question": "Hello",
          "stream": true,
          "session_id": "cb2f385cb86211efa36e0242ac120005"
     }'

Request Parameters
agent_id: (Path parameter), string
The ID of the associated agent.
"question": (Body Parameter), string, Required
The question to start an AI-powered conversation.
"stream": (Body Parameter), boolean
Indicates whether to output responses in a streaming way:
true: Enable streaming (default).
false: Disable streaming.
"session_id": (Body Parameter)
The ID of the session. If it is not provided, a new session will be generated.
"inputs": (Body Parameter)
Variables specified in the Begin component.
"user_id": (Body parameter), string
The optional user-defined ID. Valid only when no session_id is provided.
NOTE
For now, this method does not support a file type input/variable. As a workaround, use the following to upload a file to an agent:
http://{address}/v1/canvas/upload/{agent_id}
You will get a corresponding file ID from its response body.

Response
success without session_id provided and with no variables specified in the Begin component:

Stream:

...

data: {
    "event": "message",
    "message_id": "cecdcb0e83dc11f0858253708ecb6573",
    "created_at": 1756364483,
    "task_id": "d1f79142831f11f09cc51795b9eb07c0",
    "data": {
        "content": " themes"
    },
    "session_id": "cd097ca083dc11f0858253708ecb6573"
}

data: {
    "event": "message",
    "message_id": "cecdcb0e83dc11f0858253708ecb6573",
    "created_at": 1756364483,
    "task_id": "d1f79142831f11f09cc51795b9eb07c0",
    "data": {
        "content": "."
    },
    "session_id": "cd097ca083dc11f0858253708ecb6573"
}

data: {
    "event": "message_end",
    "message_id": "cecdcb0e83dc11f0858253708ecb6573",
    "created_at": 1756364483,
    "task_id": "d1f79142831f11f09cc51795b9eb07c0",
    "data": {
        "reference": {
            "chunks": {
                "20": {
                    "id": "4b8935ac0a22deb1",
                    "content": "```cd /usr/ports/editors/neovim/ && make install```## Android[Termux](https://github.com/termux/termux-app) offers a Neovim package.",
                    "document_id": "4bdd2ff65e1511f0907f09f583941b45",
                    "document_name": "INSTALL22.md",
                    "dataset_id": "456ce60c5e1511f0907f09f583941b45",
                    "image_id": "",
                    "positions": [
                        [
                            12,
                            11,
                            11,
                            11,
                            11
                        ]
                    ],
                    "url": null,
                    "similarity": 0.5705525104787287,
                    "vector_similarity": 0.7351750337624289,
                    "term_similarity": 0.5000000005,
                    "doc_type": ""
                }
            },
            "doc_aggs": {
                "INSTALL22.md": {
                    "doc_name": "INSTALL22.md",
                    "doc_id": "4bdd2ff65e1511f0907f09f583941b45",
                    "count": 3
                },
                "INSTALL.md": {
                    "doc_name": "INSTALL.md",
                    "doc_id": "4bd7fdd85e1511f0907f09f583941b45",
                    "count": 2
                },
                "INSTALL(1).md": {
                    "doc_name": "INSTALL(1).md",
                    "doc_id": "4bdfb42e5e1511f0907f09f583941b45",
                    "count": 2
                },
                "INSTALL3.md": {
                    "doc_name": "INSTALL3.md",
                    "doc_id": "4bdab5825e1511f0907f09f583941b45",
                    "count": 1
                }
            }
        }
    },
    "session_id": "cd097ca083dc11f0858253708ecb6573"
}

data:[DONE]


Non-stream:

{
    "code": 0,
    "data": {
        "created_at": 1756363177,
        "data": {
            "content": "\nTo install Neovim, the process varies depending on your operating system:\n\n### For macOS:\nUsing Homebrew:\n```bash\nbrew install neovim\n```\n\n### For Linux (Debian/Ubuntu):\n```bash\nsudo apt update\nsudo apt install neovim\n```\n\nFor other Linux distributions, you can use their respective package managers or build from source.\n\n### For Windows:\n1. Download the latest Windows installer from the official Neovim GitHub releases page\n2. Run the installer and follow the prompts\n3. Add Neovim to your PATH if not done automatically\n\n### From source (Unix-like systems):\n```bash\ngit clone https://github.com/neovim/neovim.git\ncd neovim\nmake CMAKE_BUILD_TYPE=Release\nsudo make install\n```\n\nAfter installation, you can verify it by running `nvim --version` in your terminal.",
            "created_at": 18129.044975627,
            "elapsed_time": 10.0157331670016,
            "inputs": {
                "var1": {
                    "value": "I am var1"
                },
                "var2": {
                    "value": "I am var2"
                }
            },
            "outputs": {
                "_created_time": 18129.502422278,
                "_elapsed_time": 0.00013378599760471843,
                "content": "\nTo install Neovim, the process varies depending on your operating system:\n\n### For macOS:\nUsing Homebrew:\n```bash\nbrew install neovim\n```\n\n### For Linux (Debian/Ubuntu):\n```bash\nsudo apt update\nsudo apt install neovim\n```\n\nFor other Linux distributions, you can use their respective package managers or build from source.\n\n### For Windows:\n1. Download the latest Windows installer from the official Neovim GitHub releases page\n2. Run the installer and follow the prompts\n3. Add Neovim to your PATH if not done automatically\n\n### From source (Unix-like systems):\n```bash\ngit clone https://github.com/neovim/neovim.git\ncd neovim\nmake CMAKE_BUILD_TYPE=Release\nsudo make install\n```\n\nAfter installation, you can verify it by running `nvim --version` in your terminal."
            },
            "reference": {
                "chunks": {
                    "20": {
                        "content": "```cd /usr/ports/editors/neovim/ && make install```## Android[Termux](https://github.com/termux/termux-app) offers a Neovim package.",
                        "dataset_id": "456ce60c5e1511f0907f09f583941b45",
                        "doc_type": "",
                        "document_id": "4bdd2ff65e1511f0907f09f583941b45",
                        "document_name": "INSTALL22.md",
                        "id": "4b8935ac0a22deb1",
                        "image_id": "",
                        "positions": [
                            [
                                12,
                                11,
                                11,
                                11,
                                11
                            ]
                        ],
                        "similarity": 0.5705525104787287,
                        "term_similarity": 0.5000000005,
                        "url": null,
                        "vector_similarity": 0.7351750337624289
                    }
                },
                "doc_aggs": {
                    "INSTALL(1).md": {
                        "count": 2,
                        "doc_id": "4bdfb42e5e1511f0907f09f583941b45",
                        "doc_name": "INSTALL(1).md"
                    },
                    "INSTALL.md": {
                        "count": 2,
                        "doc_id": "4bd7fdd85e1511f0907f09f583941b45",
                        "doc_name": "INSTALL.md"
                    },
                    "INSTALL22.md": {
                        "count": 3,
                        "doc_id": "4bdd2ff65e1511f0907f09f583941b45",
                        "doc_name": "INSTALL22.md"
                    },
                    "INSTALL3.md": {
                        "count": 1,
                        "doc_id": "4bdab5825e1511f0907f09f583941b45",
                        "doc_name": "INSTALL3.md"
                    }
                }
            }
        },
        "event": "workflow_finished",
        "message_id": "c4692a2683d911f0858253708ecb6573",
        "session_id": "c39f6f9c83d911f0858253708ecb6573",
        "task_id": "d1f79142831f11f09cc51795b9eb07c0"
    }
}


Success without session_id provided and with variables specified in the Begin component:

Stream:

data:{
    "event": "message",
    "message_id": "0e273472783711f0806e1a6272e682d8",
    "created_at": 1755083830,
    "task_id": "99ee29d6783511f09c921a6272e682d8",
    "data": {
        "content": "Hello"
    },
    "session_id": "0e0d1542783711f0806e1a6272e682d8"
}

data:{
    "event": "message",
    "message_id": "0e273472783711f0806e1a6272e682d8",
    "created_at": 1755083830,
    "task_id": "99ee29d6783511f09c921a6272e682d8",
    "data": {
        "content": "!"
    },
    "session_id": "0e0d1542783711f0806e1a6272e682d8"
}

data:{
    "event": "message",
    "message_id": "0e273472783711f0806e1a6272e682d8",
    "created_at": 1755083830,
    "task_id": "99ee29d6783511f09c921a6272e682d8",
    "data": {
        "content": " How"
    },
    "session_id": "0e0d1542783711f0806e1a6272e682d8"
}

...

data:[DONE]

Non-stream:

{
    "code": 0,
    "data": {
        "created_at": 1755083779,
        "data": {
            "created_at": 547400.868004651,
            "elapsed_time": 3.5037803899031132,
            "inputs": {
                "boolean_var": {
                    "type": "boolean",
                    "value": true
                },
                "int_var": {
                    "type": "integer",
                    "value": 1
                },
                "line_var": {
                    "type": "line",
                    "value": "I am line_var"
                },
                "option_var": {
                    "type": "options",
                    "value": "option 2"
                },
                "paragraph_var": {
                    "type": "paragraph",
                    "value": "a\nb\nc"
                }
            },
            "outputs": {
                "_created_time": 547400.869271305,
                "_elapsed_time": 0.0001251999055966735,
                "content": "Hello there! How can I assist you today?"
            }
        },
        "event": "workflow_finished",
        "message_id": "effdad8c783611f089261a6272e682d8",
        "session_id": "efe523b6783611f089261a6272e682d8",
        "task_id": "99ee29d6783511f09c921a6272e682d8"
    }
}

Success with variables specified in the Begin component:

Stream:

data:{
    "event": "message",
    "message_id": "5b62e790783711f0bc531a6272e682d8",
    "created_at": 1755083960,
    "task_id": "99ee29d6783511f09c921a6272e682d8",
    "data": {
        "content": "Hello"
    },
    "session_id": "979e450c781d11f095cb729e3aa55728"
}

data:{
    "event": "message",
    "message_id": "5b62e790783711f0bc531a6272e682d8",
    "created_at": 1755083960,
    "task_id": "99ee29d6783511f09c921a6272e682d8",
    "data": {
        "content": "!"
    },
    "session_id": "979e450c781d11f095cb729e3aa55728"
}

data:{
    "event": "message",
    "message_id": "5b62e790783711f0bc531a6272e682d8",
    "created_at": 1755083960,
    "task_id": "99ee29d6783511f09c921a6272e682d8",
    "data": {
        "content": " You"
    },
    "session_id": "979e450c781d11f095cb729e3aa55728"
}

...

data:[DONE]

Non-stream:

{
    "code": 0,
    "data": {
        "created_at": 1755084029,
        "data": {
            "created_at": 547650.750818867,
            "elapsed_time": 1.6227330720284954,
            "inputs": {},
            "outputs": {
                "_created_time": 547650.752800839,
                "_elapsed_time": 9.628792759031057e-05,
                "content": "Hello! It appears you've sent another \"Hello\" without additional context. I'm here and ready to respond to any requests or questions you may have. Is there something specific you'd like to discuss or learn about?"
            }
        },
        "event": "workflow_finished",
        "message_id": "84eec534783711f08db41a6272e682d8",
        "session_id": "979e450c781d11f095cb729e3aa55728",
        "task_id": "99ee29d6783511f09c921a6272e682d8"
    }
}


Failure:

{
    "code": 102,
    "message": "`question` is required."
}

List agent sessions
GET /api/v1/agents/{agent_id}/sessions?page={page}&page_size={page_size}&orderby={orderby}&desc={desc}&id={session_id}&user_id={user_id}&dsl={dsl}

Lists sessions associated with a specified agent.

Request
Method: GET
URL: /api/v1/agents/{agent_id}/sessions?page={page}&page_size={page_size}&orderby={orderby}&desc={desc}&id={session_id}
Headers:
'Authorization: Bearer <YOUR_API_KEY>'
Request example
curl --request GET \
     --url http://{address}/api/v1/agents/{agent_id}/sessions?page={page}&page_size={page_size}&orderby={orderby}&desc={desc}&id={session_id}&user_id={user_id} \
     --header 'Authorization: Bearer <YOUR_API_KEY>'


Request Parameters
agent_id: (Path parameter)
The ID of the associated agent.
page: (Filter parameter), integer
Specifies the page on which the sessions will be displayed. Defaults to 1.
page_size: (Filter parameter), integer
The number of sessions on each page. Defaults to 30.
orderby: (Filter parameter), string
The field by which sessions should be sorted. Available options:
create_time (default)
update_time
desc: (Filter parameter), boolean
Indicates whether the retrieved sessions should be sorted in descending order. Defaults to true.
id: (Filter parameter), string
The ID of the agent session to retrieve.
user_id: (Filter parameter), string
The optional user-defined ID passed in when creating session.
dsl: (Filter parameter), boolean
Indicates whether to include the dsl field of the sessions in the response. Defaults to true.
Response
Success:

{
    "code": 0,
    "data": [{
        "agent_id": "e9e2b9c2b2f911ef801d0242ac120006",
        "dsl": {
            "answer": [],
            "components": {
                "Answer:OrangeTermsBurn": {
                    "downstream": [],
                    "obj": {
                        "component_name": "Answer",
                        "params": {}
                    },
                    "upstream": []
                },
                "Generate:SocialYearsRemain": {
                    "downstream": [],
                    "obj": {
                        "component_name": "Generate",
                        "params": {
                            "cite": true,
                            "frequency_penalty": 0.7,
                            "llm_id": "gpt-4o___OpenAI-API@OpenAI-API-Compatible",
                            "message_history_window_size": 12,
                            "parameters": [],
                            "presence_penalty": 0.4,
                            "prompt": "Please summarize the following paragraph. Pay attention to the numbers and do not make things up. The paragraph is as follows:\n{input}\nThis is what you need to summarize.",
                            "temperature": 0.1,
                            "top_p": 0.3
                        }
                    },
                    "upstream": []
                },
                "begin": {
                    "downstream": [],
                    "obj": {
                        "component_name": "Begin",
                        "params": {}
                    },
                    "upstream": []
                }
            },
            "graph": {
                "edges": [],
                "nodes": [
                    {
                        "data": {
                            "label": "Begin",
                            "name": "begin"
                        },
                        "height": 44,
                        "id": "begin",
                        "position": {
                            "x": 50,
                            "y": 200
                        },
                        "sourcePosition": "left",
                        "targetPosition": "right",
                        "type": "beginNode",
                        "width": 200
                    },
                    {
                        "data": {
                            "form": {
                                "cite": true,
                                "frequencyPenaltyEnabled": true,
                                "frequency_penalty": 0.7,
                                "llm_id": "gpt-4o___OpenAI-API@OpenAI-API-Compatible",
                                "maxTokensEnabled": true,
                                "message_history_window_size": 12,
                                "parameters": [],
                                "presencePenaltyEnabled": true,
                                "presence_penalty": 0.4,
                                "prompt": "Please summarize the following paragraph. Pay attention to the numbers and do not make things up. The paragraph is as follows:\n{input}\nThis is what you need to summarize.",
                                "temperature": 0.1,
                                "temperatureEnabled": true,
                                "topPEnabled": true,
                                "top_p": 0.3
                            },
                            "label": "Generate",
                            "name": "Generate Answer_0"
                        },
                        "dragging": false,
                        "height": 105,
                        "id": "Generate:SocialYearsRemain",
                        "position": {
                            "x": 561.3457829707513,
                            "y": 178.7211182312641
                        },
                        "positionAbsolute": {
                            "x": 561.3457829707513,
                            "y": 178.7211182312641
                        },
                        "selected": true,
                        "sourcePosition": "right",
                        "targetPosition": "left",
                        "type": "generateNode",
                        "width": 200
                    },
                    {
                        "data": {
                            "form": {},
                            "label": "Answer",
                            "name": "Dialogue_0"
                        },
                        "height": 44,
                        "id": "Answer:OrangeTermsBurn",
                        "position": {
                            "x": 317.2368194777658,
                            "y": 218.30635555445093
                        },
                        "sourcePosition": "right",
                        "targetPosition": "left",
                        "type": "logicNode",
                        "width": 200
                    }
                ]
            },
            "history": [],
            "messages": [],
            "path": [],
            "reference": []
        },
        "id": "792dde22b2fa11ef97550242ac120006",
        "message": [
            {
                "content": "Hi! I'm your smart assistant. What can I do for you?",
                "role": "assistant"
            }
        ],
        "source": "agent",
        "user_id": ""
    }]
}


Failure:

{
    "code": 102,
    "message": "You don't own the agent ccd2f856b12311ef94ca0242ac1200052."
}

Delete agent's sessions
DELETE /api/v1/agents/{agent_id}/sessions

Deletes sessions of a agent by ID.

Request
Method: DELETE
URL: /api/v1/agents/{agent_id}/sessions
Headers:
'content-Type: application/json'
'Authorization: Bearer <YOUR_API_KEY>'
Body:
"ids": list[string]
Request example
curl --request DELETE \
     --url http://{address}/api/v1/agents/{agent_id}/sessions \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <YOUR_API_KEY>' \
     --data '
     {
          "ids": ["test_1", "test_2"]
     }'

Request Parameters
agent_id: (Path parameter)
The ID of the associated agent.
"ids": (Body Parameter), list[string]
The IDs of the sessions to delete. If it is not specified, all sessions associated with the specified agent will be deleted.
Response
Success:

{
    "code": 0
}

Failure:

{
    "code": 102,
    "message": "The agent doesn't own the session cbd31e52f73911ef93b232903b842af6"
}

Generate related questions
POST /api/v1/sessions/related_questions

Generates five to ten alternative question strings from the user's original query to retrieve more relevant search results.

This operation requires a Bearer Login Token, which typically expires with in 24 hours. You can find the it in the Request Headers in your browser easily as shown below:

Image

NOTE
The chat model autonomously determines the number of questions to generate based on the instruction, typically between five and ten.

Request
Method: POST
URL: /api/v1/sessions/related_questions
Headers:
'content-Type: application/json'
'Authorization: Bearer <YOUR_LOGIN_TOKEN>'
Body:
"question": string
"industry": string
Request example
curl --request POST \
     --url http://{address}/api/v1/sessions/related_questions \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <YOUR_LOGIN_TOKEN>' \
     --data '
     {
          "question": "What are the key advantages of Neovim over Vim?",
          "industry": "software_development"
     }'

Request Parameters
"question": (Body Parameter), string The original user question.
"industry": (Body Parameter), string Industry of the question.
Response
Success:

{
    "code": 0,
    "data": [
        "What makes Neovim superior to Vim in terms of features?",
        "How do the benefits of Neovim compare to those of Vim?",
        "What advantages does Neovim offer that are not present in Vim?",
        "In what ways does Neovim outperform Vim in functionality?",
        "What are the most significant improvements in Neovim compared to Vim?",
        "What unique advantages does Neovim bring to the table over Vim?",
        "How does the user experience in Neovim differ from Vim in terms of benefits?",
        "What are the top reasons to switch from Vim to Neovim?",
        "What features of Neovim are considered more advanced than those in Vim?"
    ],
    "message": "success"
}

Failure:

{
    "code": 401,
    "data": null,
    "message": "<Unauthorized '401: Unauthorized'>"
}

AGENT MANAGEMENT
List agents
GET /api/v1/agents?page={page}&page_size={page_size}&orderby={orderby}&desc={desc}&name={agent_name}&id={agent_id}

Lists agents.

Request
Method: GET
URL: /api/v1/agents?page={page}&page_size={page_size}&orderby={orderby}&desc={desc}&title={agent_name}&id={agent_id}
Headers:
'Authorization: Bearer <YOUR_API_KEY>'
Request example
curl --request GET \
     --url http://{address}/api/v1/agents?page={page}&page_size={page_size}&orderby={orderby}&desc={desc}&title={agent_name}&id={agent_id} \
     --header 'Authorization: Bearer <YOUR_API_KEY>'


Request parameters
page: (Filter parameter), integer
Specifies the page on which the agents will be displayed. Defaults to 1.
page_size: (Filter parameter), integer
The number of agents on each page. Defaults to 30.
orderby: (Filter parameter), string
The attribute by which the results are sorted. Available options:
create_time (default)
update_time
desc: (Filter parameter), boolean
Indicates whether the retrieved agents should be sorted in descending order. Defaults to true.
id: (Filter parameter), string
The ID of the agent to retrieve.
title: (Filter parameter), string
The name of the agent to retrieve.
Response
Success:

{
    "code": 0,
    "data": [
        {
            "avatar": null,
            "canvas_type": null,
            "create_date": "Thu, 05 Dec 2024 19:10:36 GMT",
            "create_time": 1733397036424,
            "description": null,
            "dsl": {
                "answer": [],
                "components": {
                    "begin": {
                        "downstream": [],
                        "obj": {
                            "component_name": "Begin",
                            "params": {}
                        },
                        "upstream": []
                    }
                },
                "graph": {
                    "edges": [],
                    "nodes": [
                        {
                            "data": {
                                "label": "Begin",
                                "name": "begin"
                            },
                            "height": 44,
                            "id": "begin",
                            "position": {
                                "x": 50,
                                "y": 200
                            },
                            "sourcePosition": "left",
                            "targetPosition": "right",
                            "type": "beginNode",
                            "width": 200
                        }
                    ]
                },
                "history": [],
                "messages": [],
                "path": [],
                "reference": []
            },
            "id": "8d9ca0e2b2f911ef9ca20242ac120006",
            "title": "123465",
            "update_date": "Thu, 05 Dec 2024 19:10:56 GMT",
            "update_time": 1733397056801,
            "user_id": "69736c5e723611efb51b0242ac120007"
        }
    ]
}

Failure:

{
    "code": 102,
    "message": "The agent doesn't exist."
}

Create agent
POST /api/v1/agents

Create an agent.

Request
Method: POST
URL: /api/v1/agents
Headers:
'Content-Type: application/json
'Authorization: Bearer <YOUR_API_KEY>'
Body:
"title": string
"description": string
"dsl": object
Request example
curl --request POST \
     --url http://{address}/api/v1/agents \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <YOUR_API_KEY>' \
     --data '{
         "title": "Test Agent",
         "description": "A test agent",
         "dsl": {
           // ... Canvas DSL here ...
         }
     }'

Request parameters
title: (Body parameter), string, Required
The title of the agent.
description: (Body parameter), string
The description of the agent. Defaults to None.
dsl: (Body parameter), object, Required
The canvas DSL object of the agent.
Response
Success:

{
    "code": 0,
    "data": true,
    "message": "success"
}

Failure:

{
    "code": 102,
    "message": "Agent with title test already exists."
}

Update agent
PUT /api/v1/agents/{agent_id}

Update an agent by id.

Request
Method: PUT
URL: /api/v1/agents/{agent_id}
Headers:
'Content-Type: application/json
'Authorization: Bearer <YOUR_API_KEY>'
Body:
"title": string
"description": string
"dsl": object
Request example
curl --request PUT \
     --url http://{address}/api/v1/agents/58af890a2a8911f0a71a11b922ed82d6 \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <YOUR_API_KEY>' \
     --data '{
         "title": "Test Agent",
         "description": "A test agent",
         "dsl": {
           // ... Canvas DSL here ...
         }
     }'

Request parameters
agent_id: (Path parameter), string
The id of the agent to be updated.
title: (Body parameter), string
The title of the agent.
description: (Body parameter), string
The description of the agent.
dsl: (Body parameter), object
The canvas DSL object of the agent.
Only specify the parameter you want to change in the request body. If a parameter does not exist or is None, it won't be updated.

Response
Success:

{
    "code": 0,
    "data": true,
    "message": "success"
}

Failure:

{
    "code": 103,
    "message": "Only owner of canvas authorized for this operation."
}

Delete agent
DELETE /api/v1/agents/{agent_id}

Delete an agent by id.

Request
Method: DELETE
URL: /api/v1/agents/{agent_id}
Headers:
'Content-Type: application/json
'Authorization: Bearer <YOUR_API_KEY>'
Request example
curl --request DELETE \
     --url http://{address}/api/v1/agents/58af890a2a8911f0a71a11b922ed82d6 \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <YOUR_API_KEY>' \
     --data '{}'

Request parameters
agent_id: (Path parameter), string
The id of the agent to be deleted.
Response
Success:

{
    "code": 0,
    "data": true,
    "message": "success"
}

Failure:

{
    "code": 103,
    "message": "Only owner of canvas authorized for this operation."
}