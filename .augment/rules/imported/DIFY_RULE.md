---
type: "agent_requested"
description: "Example description"
---

# DIFY 对话型应用 API 使用说明

## 基础信息

- **基础 URL**: `http://192.144.232.60/v1`
- **鉴权**: 所有 API 请求需在 HTTP Header 中添加
  ```
  Authorization: Bearer {API_KEY}
  ```
  强烈建议仅在后端存储和使用 API-Key，避免泄露。

---

## 对话型应用简介

对话应用支持会话持久化，可将之前的聊天记录作为上下文进行回答，适用于聊天/客服 AI 等场景。

---

## 1. 发送对话消息

### POST `/chat-messages`

**功能**：发送用户消息，支持会话持久化和多模态（图片）输入。

#### 请求参数（JSON）

| 字段                | 类型           | 说明                                                                                  |
|---------------------|----------------|---------------------------------------------------------------------------------------|
| query               | string         | 用户输入/提问内容                                                                     |
| inputs              | object         | 允许传入 App 定义的各变量值，包含多组键值对，默认 `{}`                                 |
| response_mode       | string         | `streaming`（推荐，流式SSE）或 `blocking`（阻塞，完整返回）。Agent模式下不允许blocking。|
| user                | string         | 用户唯一标识，需保证在应用内唯一，便于检索、统计                                       |
| conversation_id     | string         | （选填）会话ID，继续历史会话需传，基于之前聊天记录继续对话                             |
| files               | array[object]  | 上传的文件，见下表                                                                    |
| auto_generate_name  | bool           | （选填）自动生成标题，默认 true。为 false 时可异步生成标题                            |
| trace_id            | string         | （选填）链路追踪ID。优先级：Header > Query > Body。未指定时系统自动生成               |

**files 子对象说明**：

| 字段            | 类型    | 说明                                   |
|-----------------|---------|----------------------------------------|
| type            | string  | 支持类型：图片 image（目前仅支持图片）  |
| transfer_method | string  | `remote_url`（图片地址）或 `local_file`（上传文件）|
| url             | string  | 图片地址（仅当 transfer_method=remote_url 时）|
| upload_file_id  | string  | 上传文件ID（仅当 transfer_method=local_file 时）|

#### 请求示例

```bash
curl -X POST 'http://192.144.232.60/v1/chat-messages' \
  --header 'Authorization: Bearer {api_key}' \
  --header 'Content-Type: application/json' \
  --data-raw '{
    "inputs": {},
    "query": "What are the specs of the iPhone 13 Pro Max?",
    "response_mode": "streaming",
    "conversation_id": "",
    "user": "abc-123",
    "files": [
      {
        "type": "image",
        "transfer_method": "remote_url",
        "url": "https://cloud.dify.ai/logo/logo-site.png"
      }
    ]
  }'
```

#### 响应

- `blocking` 模式：返回完整 JSON（ChatCompletionResponse）
- `streaming` 模式：返回 SSE 流（ChunkChatCompletionResponse）

##### ChatCompletionResponse 字段

| 字段                  | 类型      | 说明                       |
|-----------------------|-----------|----------------------------|
| event                 | string    | 事件类型，固定为 message   |
| task_id               | string    | 任务 ID                    |
| id                    | string    | 唯一ID                     |
| message_id            | string    | 消息唯一 ID                |
| conversation_id       | string    | 会话 ID                    |
| mode                  | string    | App 模式，固定为 chat      |
| answer                | string    | 完整回复内容               |
| metadata              | object    | 元数据                     |
| usage                 | object    | 模型用量信息               |
| retriever_resources   | array     | 引用和归属分段列表         |
| created_at            | int       | 消息创建时间戳             |

##### ChunkChatCompletionResponse 事件类型

- `message`：LLM 文本块
- `agent_message`：Agent模式文本块
- `agent_thought`：Agent思考/工具调用
- `message_file`：新文件（如图片）
- `message_end`：消息结束
- `tts_message`/`tts_message_end`：TTS 音频流
- `message_replace`：内容替换（如命中审查）
- `error`：异常
- `ping`：心跳

**流式块字段说明**（部分事件）：

- `message`/`agent_message`：task_id, message_id, conversation_id, answer, created_at
- `agent_thought`：id, task_id, message_id, position, thought, observation, tool, tool_input, created_at, message_files, conversation_id
- `message_file`：id, type, belongs_to, url, conversation_id
- `message_end`：task_id, message_id, conversation_id, metadata, usage, retriever_resources

##### 错误码举例

- 404 对话不存在
- 400 invalid_param 参数异常
- 400 app_unavailable App 配置不可用
- 400 provider_not_initialize 无可用模型凭据配置
- 400 provider_quota_exceeded 模型额度不足
- 400 model_currently_not_support 当前模型不可用
- 400 completion_request_error 文本生成失败
- 500 服务内部异常

---

## 2. 上传文件

### POST `/files/upload`

**功能**：上传图片文件，供多模态对话使用。支持 png, jpg, jpeg, webp, gif 格式。

#### 请求参数（multipart/form-data）

| 字段 | 类型 | 说明 |
|------|------|------|
| file | file | 要上传的图片文件（png, jpg, jpeg, webp, gif）|
| user | string | 用户唯一标识，需与发送消息接口一致 |

#### 请求示例

```bash
curl -X POST 'http://192.144.232.60/v1/files/upload' \
  --header 'Authorization: Bearer {api_key}' \
  --form 'file=@localfile;type=image/png' \
  --form 'user=abc-123'
```

#### 响应

```json
{
  "id": "72fa9618-8f89-4a37-9b33-7e1178a24a67",
  "name": "example.png",
  "size": 1024,
  "extension": "png",
  "mime_type": "image/png",
  "created_by": 123,
  "created_at": 1577836800
}
```

**错误码举例**：

- 400 no_file_uploaded 必须提供文件
- 400 too_many_files 只接受一个文件
- 400 unsupported_preview 不支持预览
- 400 unsupported_estimate 不支持估算
- 413 file_too_large 文件太大
- 415 unsupported_file_type 不支持的扩展名
- 503 s3_connection_failed 无法连接到 S3
- 503 s3_permission_denied 无权限上传
- 503 s3_file_too_large 文件超出 S3 限制

---

## 3. 停止响应

### POST `/chat-messages/:task_id/stop`

**功能**：停止流式响应，仅支持流式模式。

#### 请求参数

- Path: `task_id`（任务ID，流式返回中获取）
- Body: `{ "user": "abc-123" }`（用户唯一标识，需与发送消息接口一致）

#### 响应

```json
{ "result": "success" }
```

---

## 4. 消息反馈（点赞/点踩）

### POST `/messages/:message_id/feedbacks`

**功能**：对消息进行点赞、点踩或撤销。

#### 请求参数

- Path: `message_id`
- Body:
  - `rating`: `like`/`dislike`/`null`
  - `user`: 用户唯一标识
  - `content`: 反馈内容

#### 响应

```json
{ "result": "success" }
```

---

## 5. 获取 APP 消息反馈

### GET `/app/feedbacks`

**功能**：分页获取 APP 的消息点赞和反馈。

#### 查询参数

- `page`（默认1）
- `limit`（默认20）

#### 响应

```json
{
  "data": [
    {
      "id": "...",
      "app_id": "...",
      "conversation_id": "...",
      "message_id": "...",
      "rating": "like",
      "content": "...",
      "from_source": "user",
      "from_end_user_id": "...",
      "created_at": "...",
      "updated_at": "..."
    }
  ]
}
```

---

## 其他说明

- 所有接口均需带上 `Authorization` 头部。
- 用户标识 `user` 必须在应用内唯一。
- 推荐使用 `streaming` 流式模式提升响应体验。
- 上传的文件仅供当前终端用户使用。
- trace_id 支持 Header（X-Trace-Id）、Query、Body 三种方式传递，优先级依次为 Header > Query > Body。

---
获取会话历史消息
滚动加载形式返回历史聊天记录，第一页返回最新 limit 条，即：倒序返回。

Query
Name
conversation_id
Type
string
Description
会话 ID

Name
user
Type
string
Description
用户标识，由开发者定义规则，需保证用户标识在应用内唯一。

Name
first_id
Type
string
Description
当前页第一条聊天记录的 ID，默认 null

Name
limit
Type
int
Description
一次请求返回多少条聊天记录，默认 20 条。

Response
data (array[object]) 消息列表
id (string) 消息 ID
conversation_id (string) 会话 ID
inputs (object) 用户输入参数。
query (string) 用户输入 / 提问内容。
message_files (array[object]) 消息文件
id (string) ID
type (string) 文件类型，image 图片
url (string) 预览图片地址
belongs_to (string) 文件归属方，user 或 assistant
answer (string) 回答消息内容
created_at (timestamp) 创建时间
feedback (object) 反馈信息
rating (string) 点赞 like / 点踩 dislike
retriever_resources (array[RetrieverResource]) 引用和归属分段列表
has_more (bool) 是否存在下一页
limit (int) 返回条数，若传入超过系统限制，返回系统限制数量

curl -X GET 'http://192.144.232.60/v1/messages?user=abc-123&conversation_id=' \
--header 'Authorization: Bearer {api_key}'

{
"limit": 20,
"has_more": false,
"data": [
    {
        "id": "a076a87f-31e5-48dc-b452-0061adbbc922",
        "conversation_id": "cd78daf6-f9e4-4463-9ff2-54257230a0ce",
        "inputs": {
            "name": "dify"
        },
        "query": "iphone 13 pro",
        "answer": "The iPhone 13 Pro, released on September 24, 2021, features a 6.1-inch display with a resolution of 1170 x 2532. It is equipped with a Hexa-core (2x3.23 GHz Avalanche + 4x1.82 GHz Blizzard) processor, 6 GB of RAM, and offers storage options of 128 GB, 256 GB, 512 GB, and 1 TB. The camera is 12 MP, the battery capacity is 3095 mAh, and it runs on iOS 15.",
        "message_files": [],
        "feedback": null,
        "retriever_resources": [
            {
                "position": 1,
                "dataset_id": "101b4c97-fc2e-463c-90b1-5261a4cdcafb",
                "dataset_name": "iPhone",
                "document_id": "8dd1ad74-0b5f-4175-b735-7d98bbbb4e00",
                "document_name": "iPhone List",
                "segment_id": "ed599c7f-2766-4294-9d1d-e5235a61270a",
                "score": 0.98457545,
                "content": "\"Model\",\"Release Date\",\"Display Size\",\"Resolution\",\"Processor\",\"RAM\",\"Storage\",\"Camera\",\"Battery\",\"Operating System\"\n\"iPhone 13 Pro Max\",\"September 24, 2021\",\"6.7 inch\",\"1284 x 2778\",\"Hexa-core (2x3.23 GHz Avalanche + 4x1.82 GHz Blizzard)\",\"6 GB\",\"128, 256, 512 GB, 1TB\",\"12 MP\",\"4352 mAh\",\"iOS 15\""
            }
        ],
        "created_at": 1705569239
    }
  ]
}


{
"limit": 20,
"has_more": false,
"data": [
    {
        "id": "d35e006c-7c4d-458f-9142-be4930abdf94",
        "conversation_id": "957c068b-f258-4f89-ba10-6e8a0361c457",
        "inputs": {},
        "query": "draw a cat",
        "answer": "I have generated an image of a cat for you. Please check your messages to view the image.",
        "message_files": [
            {
                "id": "976990d2-5294-47e6-8f14-7356ba9d2d76",
                "type": "image",
                "url": "http://127.0.0.1:5001/files/tools/976990d2-5294-47e6-8f14-7356ba9d2d76.png?timestamp=1705988524&nonce=55df3f9f7311a9acd91bf074cd524092&sign=z43nMSO1L2HBvoqADLkRxr7Biz0fkjeDstnJiCK1zh8=",
                "belongs_to": "assistant"
            }
        ],
        "feedback": null,
        "retriever_resources": [],
        "created_at": 1705988187
    }
    ]
}

获取会话列表
获取当前用户的会话列表，默认返回最近的 20 条。

Query
Name
user
Type
string
Description
用户标识，由开发者定义规则，需保证用户标识在应用内唯一。

Name
last_id
Type
string
Description
（选填）当前页最后面一条记录的 ID，默认 null

Name
limit
Type
int
Description
（选填）一次请求返回多少条记录，默认 20 条，最大 100 条，最小 1 条。

Name
sort_by
Type
string
Description
（选填）排序字段，默认 -updated_at(按更新时间倒序排列)

可选值：created_at, -created_at, updated_at, -updated_at
字段前面的符号代表顺序或倒序，-代表倒序
Response
data (array[object]) 会话列表
id (string) 会话 ID
name (string) 会话名称，默认由大语言模型生成。
inputs (object) 用户输入参数。
status (string) 会话状态
introduction (string) 开场白
created_at (timestamp) 创建时间
updated_at (timestamp) 更新时间
has_more (bool)
limit (int) 返回条数，若传入超过系统限制，返回系统限制数量

curl -X GET 'http://192.144.232.60/v1/conversations?user=abc-123&last_id=&limit=20'\
--header 'Authorization: Bearer {api_key}'

{
  "limit": 20,
  "has_more": false,
  "data": [
    {
      "id": "10799fb8-64f7-4296-bbf7-b42bfbe0ae54",
      "name": "New chat",
      "inputs": {
          "book": "book",
          "myName": "Lucy"
      },
      "status": "normal",
      "created_at": 1679667915,
      "updated_at": 1679667915
    },
    {
      "id": "hSIhXBhNe8X1d8Et"
      // ...
    }
  ]
}


删除会话
删除会话。

Path
conversation_id (string) 会话 ID
Request Body
Name
user
Type
string
Description
用户标识，由开发者定义规则，需保证用户标识在应用内唯一。

Response
result (string) 固定返回 success

curl -X DELETE 'http://192.144.232.60/v1/conversations/:conversation_id' \
--header 'Authorization: Bearer {api_key}' \
--header 'Content-Type: application/json' \
--data-raw '{ 
 "user": "abc-123"
}'


会话重命名
对会话进行重命名，会话名称用于显示在支持多会话的客户端上。

Path
conversation_id (string) 会话 ID
Request Body
Name
name
Type
string
Description
（选填）名称，若 auto_generate 为 true 时，该参数可不传。

Name
auto_generate
Type
bool
Description
（选填）自动生成标题，默认 false。

Name
user
Type
string
Description
用户标识，由开发者定义规则，需保证用户标识在应用内唯一。

Response
id (string) 会话 ID
name (string) 会话名称
inputs (object) 用户输入参数
status (string) 会话状态
introduction (string) 开场白
created_at (timestamp) 创建时间
updated_at (timestamp) 更新时间

curl -X POST 'http://192.144.232.60/v1/conversations/:conversation_id/name' \
--header 'Authorization: Bearer {api_key}' \
--header 'Content-Type: application/json' \
--data-raw '{ 
 "name": "", 
 "auto_generate": true, 
 "user": "abc-123"
}'

{
  "id": "34d511d5-56de-4f16-a997-57b379508443",
  "name": "hello",
  "inputs": {},
  "status": "normal",
  "introduction": "",
  "created_at": 1732731141,
  "updated_at": 1732734510
}

获取对话变量
从特定对话中检索变量。此端点对于提取对话过程中捕获的结构化数据非常有用。

路径参数
Name
conversation_id
Type
string
Description
要从中检索变量的对话ID。

查询参数
Name
user
Type
string
Description
用户标识符，由开发人员定义的规则，在应用程序内必须唯一。

Name
last_id
Type
string
Description
（选填）当前页最后面一条记录的 ID，默认 null

Name
limit
Type
int
Description
（选填）一次请求返回多少条记录，默认 20 条，最大 100 条，最小 1 条。

响应
limit (int) 每页项目数
has_more (bool) 是否有更多项目
data (array[object]) 变量列表
id (string) 变量 ID
name (string) 变量名称
value_type (string) 变量类型（字符串、数字、布尔等）
value (string) 变量值
description (string) 变量描述
created_at (int) 创建时间戳
updated_at (int) 最后更新时间戳
错误
404, conversation_not_exists, 对话不存在

curl -X GET 'http://192.144.232.60/v1/conversations/{conversation_id}/variables?user=abc-123' \
--header 'Authorization: Bearer {api_key}'


curl -X GET '${props.appDetail.api_base_url}/conversations/{conversation_id}/variables?user=abc-123&variable_name=customer_name' \
--header 'Authorization: Bearer {api_key}'


{
  "limit": 100,
  "has_more": false,
  "data": [
    {
      "id": "variable-uuid-1",
      "name": "customer_name",
      "value_type": "string",
      "value": "John Doe",
      "description": "客户名称（从对话中提取）",
      "created_at": 1650000000000,
      "updated_at": 1650000000000
    },
    {
      "id": "variable-uuid-2",
      "name": "order_details",
      "value_type": "json",
      "value": "{\"product\":\"Widget\",\"quantity\":5,\"price\":19.99}",
      "description": "客户的订单详情",
      "created_at": 1650000000000,
      "updated_at": 1650000000000
    }
  ]
}
